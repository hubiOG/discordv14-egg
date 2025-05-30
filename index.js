const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// Hardcoded Token und Guild-ID
const TOKEN = 'YOURTOKEN';
const GUILD_ID = 'YOURGUILDID';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Command-Daten für Deployment sammeln
const commands = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function deployCommands() {
  try {
    console.log('Starte Command Deployment...');

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands },
    );

    console.log('Commands erfolgreich deployed!');
  } catch (error) {
    console.error('Fehler beim Command Deployment:', error);
  }
}

client.once('ready', async () => {
  console.log(`Bot eingeloggt als ${client.user.tag}`);

  // Commands deployen, wenn Bot bereit ist
  await deployCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Fehler beim Ausführen des Commands:', error);
    await interaction.reply({ content: 'Beim Ausführen des Commands ist ein Fehler aufgetreten!', ephemeral: true });
  }
});

client.login(TOKEN);

