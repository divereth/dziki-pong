import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { GAMES, getGame } from './games.mjs';
import { publicFile } from './game-tools.mjs';

export function gamesForPaths(paths) {
  return Object.entries(GAMES).filter(([id, config]) => {
    const game = { id, ...config };
    const prefix = game.site === '.' ? '' : `${game.site}/`;
    return paths.some(path => path.startsWith(prefix) && publicFile(game, path.slice(prefix.length)));
  }).map(([id]) => id);
}

if (process.env.GITHUB_EVENT_PATH && process.argv[1]?.replaceAll('\\', '/').endsWith('/automation/select-games.mjs')) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let ids;
  if (process.env.GITHUB_EVENT_NAME === 'repository_dispatch') ids = [getGame(event.client_payload?.game_id || 'dziki-pong').id];
  else if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') ids = event.inputs?.game_id === 'all' ? Object.keys(GAMES) : [getGame(event.inputs?.game_id || 'dziki-pong').id];
  else {
    const before = event.before;
    const after = event.after;
    if (!/^[a-f0-9]{40}$/.test(after || '')) throw new Error('Invalid push SHA');
    const paths = !before || /^0+$/.test(before)
      ? execFileSync('git', ['ls-tree', '-r', '--name-only', after], { encoding: 'utf8' })
      : execFileSync('git', ['diff', '--name-only', before, after], { encoding: 'utf8' });
    ids = gamesForPaths(paths.split('\n').filter(Boolean));
  }
  const matrix = { include: ids.map(game_id => ({ game_id })) };
  appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\ncount=${ids.length}\n`);
  console.log('Selected games:', ids.join(', ') || '(no public game changes)');
}
