# Uniboar address alias

The game is deployed once, at **https://dzikibieg.pages.dev/**.
**https://uniboar.pages.dev/** forwards to it, preserving the path and query.
Future game updates require only the normal canonical production deployment.

This tiny Cloudflare Pages Worker replaces the former duplicate game deployment:

- Game navigations and assets forward to the canonical site.
- `/sw.js` installs a retirement worker, removes only the old origin's
  `robot-uniboar-*` caches, unregisters itself, and navigates old PWA windows.
- `/api/leaderboard` proxies to the canonical API to support older open tabs,
  including POST submissions, without introducing a cross-origin redirect.
- Both addresses continue to use the same production leaderboard database.

From the repository root:

```sh
node --test games/dziki-bieg/hosting/uniboar-alias/worker.test.mjs
node games/dziki-bieg/hosting/uniboar-alias/build.mjs
wrangler pages deploy .artifacts/uniboar-alias --project-name uniboar --branch main --commit-dirty=true
```

Keep this alias deployed to `uniboar`; publish all future game builds to
`dzikibieg` through the existing production workflow. The alias contains no
game copy and needs no database binding of its own.
