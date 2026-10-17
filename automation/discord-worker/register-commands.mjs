import { readFileSync } from 'node:fs';
import { registerCommands } from './commands.mjs';

const config = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
const guildId = process.env.DISCORD_GUILD_ID || config.match(/^DISCORD_GUILD_ID\s*=\s*"(\d+)"/m)?.[1];
await registerCommands({ token: process.env.DISCORD_BOT_TOKEN, applicationId: process.env.DISCORD_APPLICATION_ID, guildId });
console.log('Registered /dzika zmiana, /dzika promote and /ostatnie zmiany.');
