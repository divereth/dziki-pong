# Discord-controlled Dziki Pong

This bridge turns messages in one Discord channel into reviewed GitHub changes.

The default flow is:

1. A message in the configured channel is validated by the bot.
2. The bot dispatches a GitHub event with the request text.
3. GitHub Actions creates a branch, runs the Codex GitHub Action, commits the change, opens a pull request, and deploys that branch as a separate Cloudflare Pages preview.
4. Only a member with the configured admin role can send `!dziki promote <request-id>`.
5. The promotion workflow merges that PR. A separate production workflow deploys `main` to the live Cloudflare Pages site.

## Discord bot

Create a Discord application and bot, enable the **Message Content Intent**, and invite it with permission to view and send messages in the chosen channel.

Run the bot on an always-on Node.js host (a small VPS, container service, or home machine that stays online). Copy `.env.example` to `.env`, fill in the values, then run:

```sh
npm install
npm start
```

Use a fine-grained GitHub token limited to this repository with **Contents: read and write** permission so it can trigger repository dispatches. Keep the token and bot token outside Git.

The bot accepts normal game-change requests in the configured channel. It also accepts:

```
!dziki promote <request-id>
```

The admin role ID is checked by the bot and the GitHub workflow checks the signed payload again before merging.

## GitHub secrets

Add these repository secrets before enabling the workflows:

- `OPENAI_API_KEY` — used only by `openai/codex-action@v1`.
- `CLOUDFLARE_API_TOKEN` — Pages deployment token scoped to the `dziki-pong` project.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account containing the Pages project.
- `CLOUDFLARE_PROJECT_NAME` — `dziki-pong`.
- `DISCORD_STATUS_WEBHOOK_URL` — optional webhook for deployment status messages.

The bot itself needs `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, `DISCORD_ADMIN_ROLE_ID`, `GITHUB_DISPATCH_TOKEN`, and `GITHUB_REPOSITORY`.

## Safety model

Discord input is treated as untrusted. The bot rejects obvious destructive, secret-exfiltration, and security-bypass requests. Codex receives a second policy prompt and is limited to the game source. Every request gets its own branch, commit, PR, and preview URL. Production is changed only by the admin promotion command and the protected merge workflow.

Also protect `main` in GitHub and require the workflow checks before merging. Never put tokens in Discord messages or repository files.
