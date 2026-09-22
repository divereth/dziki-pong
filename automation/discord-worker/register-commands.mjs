const {
  DISCORD_BOT_TOKEN,
  DISCORD_APPLICATION_ID,
  DISCORD_GUILD_ID,
} = process.env;

for (const [name, value] of Object.entries({ DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID })) {
  if (!value) throw new Error(`Missing ${name}`);
}

const commands = [{
  name: 'dzika',
  description: 'Zgłoś lub opublikuj zmianę w Dziki Pong',
  type: 1,
  options: [
    {
      name: 'zmiana',
      description: 'Zaproponuj zmianę w grze',
      type: 1,
      options: [{
        name: 'text',
        description: 'Co ma się zmienić w grze?',
        type: 3,
        required: true,
        min_length: 8,
        max_length: 2000,
      }],
    },
    {
      name: 'promote',
      description: 'Opublikuj sprawdzoną zmianę (tylko administrator)',
      type: 1,
      options: [{
        name: 'request_id',
        description: 'Oznaczenie prośby z kanału deweloperskiego',
        type: 3,
        required: true,
        min_length: 3,
        max_length: 80,
      }],
    },
  ],
}];

const response = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`, {
  method: 'PUT',
  headers: {
    authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    'content-type': 'application/json',
    'user-agent': 'dziki-pong-command-registration',
  },
  body: JSON.stringify(commands),
});

if (!response.ok) throw new Error(`Command registration failed: ${response.status} ${await response.text()}`);
console.log('Registered /dzika zmiana and /dzika promote.');
