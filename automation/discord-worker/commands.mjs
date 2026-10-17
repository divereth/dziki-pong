export const commands = [{
  name: 'dzika',
  description: 'Zgłoś lub opublikuj zmianę w grze przypisanej do kanału',
  type: 1,
  options: [
    { name: 'zmiana', description: 'Zaproponuj zmianę w grze', type: 1, options: [{ name: 'text', description: 'Co ma się zmienić w grze?', type: 3, required: true, min_length: 8, max_length: 2000 }] },
    { name: 'promote', description: 'Opublikuj sprawdzoną zmianę (tylko administrator)', type: 1, options: [{ name: 'request_id', description: 'Numer zlecenia z kanału gry', type: 3, required: true, min_length: 3, max_length: 40 }] },
  ],
}, {
  name: 'ostatnie', description: 'Historia gry przypisanej do tego kanału', type: 1,
  options: [{ name: 'zmiany', description: 'Pokaż autorów, daty, opisy i podglądy pięciu ostatnich zmian', type: 1 }],
}];

export async function registerCommands({ token, applicationId, guildId, send = fetch }) {
  if (!token) throw new Error('Missing DISCORD_BOT_TOKEN');
  if (!/^\d{15,22}$/.test(guildId || '')) throw new Error('Invalid DISCORD_GUILD_ID');
  const headers = { authorization: `Bot ${token}`, 'content-type': 'application/json', 'user-agent': 'dziki-command-registration' };
  if (!applicationId) {
    const response = await send('https://discord.com/api/v10/applications/@me', { headers });
    if (!response.ok) throw new Error(`Bot application lookup failed (${response.status})`);
    applicationId = (await response.json()).id;
  }
  if (!/^\d{15,22}$/.test(applicationId || '')) throw new Error('Invalid Discord application ID');
  for (const command of commands) {
    // Upsert our commands individually; preserve other commands belonging to the app.
    const response = await send(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, { method: 'POST', headers, body: JSON.stringify(command) });
    if (!response.ok) throw new Error(`Command /${command.name} registration failed (${response.status})`);
  }
  return commands.map(command => command.name);
}
