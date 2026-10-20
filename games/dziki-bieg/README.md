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
