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

Every final total across the three wishes, including zero, can be submitted with
a nickname. The ranking retains the best 1,000,000 entries; ties favor older
entries. After saving, the screen shows the top three and four entries either
side of the player's highlighted place. Top / previous / next / my score controls
browse 25 entries at a time, using indexed cursors rather than deep offsets.
The score form and controls stay visible while the table scrolls.

`GET /api/leaderboard` returns a first page; `?near=SUBMISSION_UUID` returns the
personal window. `?cursor=TOKEN&direction=before|after` loads adjacent pages.
Use Find to search a full nickname or its beginning, ignoring case and accents.
The search=NICK query returns matching entries with global ranks. Keep search
when following its previous / next cursors. Matches are ordered by folded
nickname, then score; an indexed prefix range avoids a full-table substring scan.
The search form temporarily replaces score entry; Top restores it with the
unsaved game score intact. Apply backend/migrate-nickname-search.sql and
backfill folded keys for existing rows before deploying this worker.

Responses include `scores`, `total`, `myRank`, `previous`, `next`, `pageSize`, and
`limit`. POST accepts `{nickname,score,submissionId}` and returns the personal
view plus `submitted`. UUID retries are idempotent. Nicknames render as text.
Offline gameplay continues with an explicit network retry for global scores.

The database maintains total and score-bucket counts with triggers, so reading
the count and locating ordinary ranks do not scan the entire leaderboard.
An indexed deletion of the lowest entry occurs only when insertion exceeds the
retention cap. Responses contain at most 25 rows (12 for a personal view).
The new `leaderboard_entries` table leaves legacy `scores` intact. To migrate,
apply `backend/schema.sql`, then `backend/migrate-top-six.sql` before deployment;
repeat the idempotent copy after both old deployments have been replaced to
catch submissions made during rollout. Never clear either production table.

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

On mobile, the left screen half jumps (hold for height; release and tap again
for a double jump), and the right half dashes. Touches in the letterboxing also
work. Both hands can be used simultaneously. Subtle per-action hints disappear
when that move is first performed, remain cleared across wishes, and reset for
a new game. Menu, pause and fullscreen buttons retain their normal touch actions.
