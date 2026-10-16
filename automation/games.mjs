// Shared by the signed Discord endpoint and the trusted CI scripts.
export const GAMES = Object.freeze({
  'dziki-pong': { name: 'Dziki Pong', channel: 'dziki-pong', root: '.', site: '.', project: 'dziki-pong', secret: 'PONG' },
  'dziki-sprzedawca': { name: 'Dziki Sprzedawca', channel: 'dziki-sprzedawca', root: 'games/dziki-sprzedawca', site: 'games/dziki-sprzedawca', project: 'dzikisprzedawca', secret: 'SPRZEDAWCA' },
  'dziki-bieg': { name: 'Dziki Bieg', channel: 'dziki-bieg', root: 'games/dziki-bieg', site: 'games/dziki-bieg/dist', project: 'dzikibieg', secret: 'BIEG' },
  'dziki-karabin': { name: 'Dziki Karabin', channel: 'dziki-karabin', root: 'games/dziki-karabin', site: 'games/dziki-karabin/dist', project: 'dzikikarabin', secret: 'KARABIN' },
});

export function getGame(id = 'dziki-pong') {
  if (!Object.hasOwn(GAMES, id)) throw new Error('Unknown game');
  return { id, ...GAMES[id] };
}

export function gameForInteraction(interaction, env) {
  const channelId = interaction.channel_id || interaction.channel?.id;
  for (const [id, game] of Object.entries(GAMES)) {
    const configuredId = env[`DISCORD_${game.secret}_CHANNEL_ID`]
      || (id === 'dziki-pong' ? env.DISCORD_CHANNEL_ID : '');
    // Once an ID is pinned, renaming or duplicating a channel cannot reroute it.
    if (configuredId ? channelId === configuredId : interaction.channel?.name === game.channel) return getGame(id);
  }
  return null;
}

export function previewUrl(game, requestId) {
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(requestId)) throw new Error('Invalid request id');
  return `https://discord-${requestId.toLowerCase().replaceAll('_', '-')}.${game.project}.pages.dev/`;
}

export function productionUrl(game) { return `https://${game.project}.pages.dev/`; }

export function statusWebhook(env, game) {
  return env[`DISCORD_${game.secret}_WEBHOOK_URL`]
    || (game.id === 'dziki-pong' ? env.DISCORD_STATUS_WEBHOOK_URL : '');
}
