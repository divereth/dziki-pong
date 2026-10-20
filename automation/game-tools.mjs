import { readdirSync, lstatSync, mkdirSync, copyFileSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { getGame } from './games.mjs';

export const repositoryRoot = process.env.DZIKI_REPOSITORY_ROOT || fileURLToPath(new URL('../', import.meta.url));
const publicExtension = /\.(?:html|css|js|json|webmanifest|png|jpe?g|gif|webp|svg|ico|avif|bmp|apng|mp3|wav|ogg|oga|opus|m4a|aac|flac|mid|midi|woff2?|ttf)$/i;

export function publicFile(game, path) {
  if (path.includes('\\') || path.split('/').some(p => p.startsWith('.') || p === 'node_modules')) return false;
  if (/(?:^|\/)(?:package(?:-lock)?\.json|.*\.test\.[cm]?js|README\.md)$/i.test(path)) return false;
  if (game.id === 'dziki-pong' && path.includes('/') && !/^(?:assets|icons)\//.test(path)) return false;
  return publicExtension.test(path) || path === '_headers' || path === 'vendor/THREE-LICENSE.txt';
}

export function allowedChange(game, path) {
  const prefix = game.site === '.' ? '' : `${game.site}/`;
  if (!path.startsWith(prefix)) return false;
  const local = path.slice(prefix.length);
  if (game.id === 'dziki-bieg' && ['_worker.js','_routes.json','_redirects'].includes(local)) return false;
  if (!publicFile(game, local) || local === '_headers' || local.startsWith('vendor/')) return false;
  if (game.id === 'dziki-pong' && !local.includes('/')) return ['game.js', 'style.css', 'index.html', 'manifest.webmanifest', 'service-worker.js'].includes(local);
  return true;
}

export function filesUnder(directory) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed: ${full}`);
      if (entry.isDirectory()) visit(full);
      else files.push(relative(directory, full).replaceAll('\\', '/'));
    }
  }
  visit(directory);
  return files;
}

export function validateChanges(game, cwd = repositoryRoot, {allowEmpty = false} = {}) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const paths = [...new Set([
    ...git('diff', '--name-only', '-z', 'HEAD').split('\0'),
    ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0'),
  ].filter(Boolean))];
  if (!paths.length && !allowEmpty) throw new Error('No game changes');
  for (const path of paths) {
    if (!allowedChange(game, path)) throw new Error(`Blocked unexpected file change: ${path}`);
    const full = resolve(cwd, path);
    // Every path component must remain a real directory/file, including staged changes.
    let current = cwd;
    for (const part of path.split('/')) {
      current = join(current, part);
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink not allowed: ${path}`);
    }
    if (!lstatSync(full).isFile()) throw new Error(`Not a file: ${path}`);
  }
  return paths;
}

export function checkGame(game) {
  const site = resolve(repositoryRoot, game.site);
  for (const path of filesUnder(site).filter(path => publicFile(game, path) && path.endsWith('.js') && !path.startsWith('vendor/'))) {
    execFileSync(process.execPath, ['--check', join(site, path)], { stdio: 'inherit' });
  }
  const tests = {
    'dziki-sprzedawca': ['economy.test.js', 'customers.test.js', 'market.test.js'],
    'dziki-bieg': ['tests/mechanics.mjs', 'tests/presentation.mjs', 'tests/rendering.test.mjs', 'tests/camera.test.mjs', 'tests/leaderboard.test.mjs', 'backend/worker.test.mjs'],
    'dziki-karabin': ['tests/core.test.mjs', 'tests/runtime.test.mjs', 'tests/touch.test.mjs'],
  }[game.id];
  if (tests) execFileSync(process.execPath, ['--test', ...tests], { cwd: resolve(repositoryRoot, game.root), stdio: 'inherit' });
}

export function buildGame(game) {
  const site = resolve(repositoryRoot, game.site);
  // Rebuild Uniboar's content-hashed offline cache for every preview and release.
  if (game.id === 'dziki-bieg') execFileSync(process.execPath, ['build-pwa.mjs'], { cwd: resolve(repositoryRoot, game.root), stdio: 'inherit' });
  const output = resolve(repositoryRoot, '.artifacts', game.id);
  mkdirSync(output, { recursive: true });
  const candidates = game.id === 'dziki-pong'
    ? ['index.html', 'style.css', 'game.js', 'manifest.webmanifest', 'service-worker.js', ...filesUnder(join(site, 'assets')).map(p => `assets/${p}`), ...filesUnder(join(site, 'icons')).map(p => `icons/${p}`)]
    : filesUnder(site);
  for (const path of candidates.filter(path => publicFile(game, path))) {
    mkdirSync(join(output, path, '..'), { recursive: true });
    copyFileSync(join(site, path), join(output, path));
  }
  // Server code is trusted infrastructure, outside the Discord agent's files.
  if (game.id === 'dziki-bieg') {
    copyFileSync(resolve(repositoryRoot, game.root, 'backend/worker.mjs'), join(output, '_worker.js'));
    writeFileSync(join(output, '_routes.json'), JSON.stringify({version:1,include:['/api/leaderboard'],exclude:[]})+'\n');
  }
  // A missing entry point should never produce a successful deployment.
  readFileSync(join(output, 'index.html'));
  return output;
}

export function configureGame(game, env = process.env) {
  const values = { GAME_ID: game.id, GAME_NAME: game.name, GAME_ROOT: game.root, GAME_SITE: game.site, CF_PROJECT: game.project, GAME_URL: `https://${game.project}.pages.dev/`, GAME_SECRET: game.secret };
  if (env.GITHUB_ENV) appendFileSync(env.GITHUB_ENV, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, id] = process.argv.slice(2);
  const game = getGame(id || process.env.GAME_ID || 'dziki-pong');
  if (command === 'configure') console.log(configureGame(game));
  else if (command === 'validate') console.log(validateChanges(game));
  else if (command === 'check') checkGame(game);
  else if (command === 'build') console.log(buildGame(game));
  else throw new Error('Unknown game command');
}
