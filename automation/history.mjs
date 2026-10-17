import { previewUrl } from './games.mjs';

export function requestMetadata(body = '') {
  const matches = [...body.matchAll(/<!-- dziki-pong-request:start -->\s*\n([^\n]+)\r?\n<!-- dziki-pong-request:end -->/g)];
  if (!matches.length) return null;
  try { return JSON.parse(matches.at(-1)[1]); } catch { return null; }
}

export function historyCandidate(pr, game) {
  const metadata = requestMetadata(pr.body);
  if (!metadata || (metadata.game_id || 'dziki-pong') !== game.id) return null;
  const id = metadata.request_id;
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(id || '') || pr.head?.ref !== `discord/${id}` || pr.base?.ref !== 'main') return null;
  if (typeof metadata.request_text !== 'string' || !metadata.request_text.trim()) return null;
  const date = Date.parse(pr.created_at);
  if (!Number.isFinite(date)) return null;
  return { id, authorId: /^\d{15,22}$/.test(metadata.author_discord_id || '') ? metadata.author_discord_id : null, date, change: metadata.request_text, url: previewUrl(game, id), published: Boolean(pr.merged_at) };
}

export async function recentChanges(game, env, { send = fetch, limit = 5 } = {}) {
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) throw new Error('Invalid history repository');
  const response = await send(`https://api.github.com/repos/${repository}/pulls?state=all&sort=created&direction=desc&per_page=100`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'dziki-game-history' },
    cf: { cacheTtl: 60, cacheEverything: true },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`History lookup failed (${response.status})`);
  const prs = await response.json();
  if (!Array.isArray(prs)) throw new Error('Invalid history response');
  const candidates = prs.map(pr => historyCandidate(pr, game)).filter(Boolean).sort((a, b) => b.date - a.date).slice(0, 20);
  const result = [];
  for (let offset = 0; offset < candidates.length && result.length < limit; offset += 5) {
    const batch = await Promise.all(candidates.slice(offset, offset + 5).map(async entry => {
      try {
        // A PR can exist before its upload succeeds. List only previews that actually work.
        const preview = await send(entry.url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        return preview.ok ? entry : null;
      } catch { return null; }
    }));
    result.push(...batch.filter(Boolean));
  }
  return result.slice(0, limit);
}

const summary = text => text.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[\\`*_{}[\]()~>|]/g, '\\$&').slice(0, 700);

export function historyMessage(game, entries) {
  if (!entries.length) return { content: `📜 **${game.name} — ostatnie zmiany**\nNie ma jeszcze gotowych podglądów zmian tej gry.`, allowed_mentions: { parse: [] } };
  return {
    content: `📜 **${game.name} — ostatnie zmiany**`,
    allowed_mentions: { parse: [] },
    embeds: entries.map((entry, index) => ({
      title: `${index + 1}. ${entry.published ? 'Zmiana opublikowana' : 'Gotowy podgląd'}`,
      description: summary(entry.change),
      color: entry.published ? 0x43b581 : 0x7451d7,
      fields: [
        { name: 'Zlecił(a)', value: entry.authorId ? `<@${entry.authorId}>` : 'Brak danych autora', inline: true },
        { name: 'Data', value: `<t:${Math.floor(entry.date / 1000)}:f>`, inline: true },
        { name: 'Gra ze zmianą', value: `[Otwórz podgląd](${entry.url})` },
      ],
      footer: { text: `Zlecenie ${entry.id}` },
    })),
  };
}
