# Robot Uniboar Attack (Dziki Bieg)

This directory is the current source for https://dzikibieg.pages.dev/ and
`/dzika zmiana` requests from #dziki-bieg. The old Dziki Bieg runner was replaced
on 2026-10-20 with the current Uniboar game, including its forest artwork,
Always Free soundtrack, larger fairy pickup boxes and offscreen cone cleanup.

The Discord channel, game ID `dziki-bieg`, and Cloudflare project `dzikibieg`
stay the same. The public entry point is `dist/main.js`; mechanics are in
`dist/engine.js`, terrain in `dist/terrain.js`, graphics in `dist/art.js`, and
audio in `dist/audio.js`. The game retains its original 34 Hz physics and three wishes.

Run the same checks and build used by the Discord workflow from the repository root:

```sh
node automation/game-tools.mjs check dziki-bieg
node automation/game-tools.mjs build dziki-bieg
```

The public deploy package is `.artifacts/dziki-bieg/`. Each build regenerates
`dist/sw.js` from `sw-template.js` and hashes the current assets into a new PWA
cache. Both request previews and production promotions use this same package.

Future game updates must reach this repository, because Discord checks out main;
a direct Cloudflare upload alone does not update the bot's source.

Requests made after migration record `source_version: robot-uniboar-attack-v1`.
Promotion rejects pre-migration Bieg requests to prevent restoring the old game.
Submit an old request again with `/dzika zmiana` to apply it to Uniboar.

## Global leaderboard

The final game-over screen loads the global best six totals across all three
wishes from `/api/leaderboard`. A qualifying score can be saved with a nickname;
the server checks qualification again when saving, including concurrent scores.
Nickname entry does not trigger game controls. Only the nickname preference is
stored locally; rankings are always read from the server. Offline play continues,
with an explicit retry control for unavailable global scores.

`backend/worker.mjs` is a trusted Pages worker injected by the build, with
`_routes.json` limiting it to the leaderboard endpoint. D1 binding `SCORES_DB`
uses separate production and preview stores; both public game domains share the
production leaderboard. Database IDs are recorded in `backend/deployment.json`.
The schema is in `backend/schema.sql`. Apply it before publishing to a new binding.
Discord-generated changes can edit `dist/leaderboard.js` and its UI, but cannot
change backend code, bindings or reserved Pages routing files.

## In-game settings

Settings are available in the main menu, pause menu and result/game-over menu.
Music and sound-effects levels are independent and saved on this device.
Fullscreen is always available at the top-left inside the game, including settings.
The top-right pause control is shown during play; P also pauses/resumes.
The external toolbar and local music-file picker have been removed. Installation
and offline readiness remain available inside Settings.
