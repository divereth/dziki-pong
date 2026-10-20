import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output = new URL('../../../../.artifacts/uniboar-alias/', import.meta.url);
await mkdir(output, {recursive: true});
await writeFile(new URL('_worker.js', output), await readFile(new URL('./worker.mjs', import.meta.url)));
await writeFile(new URL('_routes.json', output), JSON.stringify({version: 1, include: ['/*'], exclude: []}) + '\n');
await writeFile(new URL('index.html', output), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=https://dzikibieg.pages.dev/"><title>Robot Uniboar Attack</title><a href="https://dzikibieg.pages.dev/">Open Robot Uniboar Attack</a></html>\n');
console.log(fileURLToPath(output));
