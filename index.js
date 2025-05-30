const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

// Hardcoded Token und Guild-ID
const TOKEN = 'YOURTOKEN';
const GUILD_ID = 'YOURGUILDID';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandCachePath = path.join(__dirname, 'commands-cache.json');

// Erstellt Ordner beim ersten Start, falls nicht vorhanden
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
  console.log('[Setup] Ordner "commands" erstellt.');
}

// Hilfsfunktion: Modifikationszeiten der Dateien lesen
function getCommandFileStats() {
  const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  return Object.fromEntries(
    files.map(file => {
      const filePath = path.join(commandsPath, file);
      const stat = fs.statSync(filePath);
      return [file, stat.mtimeMs];
    })
  );
}

// Vergleicht aktuelle Stats mit Cache
function haveCommandsChanged(currentStats, cachedStats) {
  if (!cachedStats) return true;
  const allFiles = new Set([...Object.keys(currentStats), ...Object.keys(cachedStats)]);
  for (const file of allFiles) {
    if (currentStats[file] !== cachedStats[file]) return true;
  }
  return false;
}

// Hauptfunktion für Command-Deployment
async function deployCommands(commandFiles, commands) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('[Deploy] Starte Command Deployment...');

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands },
    );

    console.log('[Deploy] Commands erfolgreich deployed!');
  } catch (error) {
    console.error('[Deploy] Fehler beim Command Deployment:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot eingeloggt als ${client.user.tag}`);

  const currentStats = getCommandFileStats();
  let cachedStats = null;

  if (fs.existsSync(commandCachePath)) {
    try {
      cachedStats = JSON.parse(fs.readFileSync(commandCachePath, 'utf8'));
    } catch (e) {
      console.warn('[Cache] Fehler beim Laden des Caches, ignoriere Cache.');
    }
  }

  if (haveCommandsChanged(currentStats, cachedStats)) {
    console.log('[Check] Änderungen an Commands erkannt. Aktualisiere...');
    const commandFiles = Object.keys(currentStats);
    const commands = [];

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command?.data) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      }
    }

    await deployCommands(commandFiles, commands);

    fs.writeFileSync(commandCachePath, JSON.stringify(currentStats, null, 2));
  } else {
    console.log('[Check] Keine Änderungen an Commands erkannt.');
    const commandFiles = Object.keys(currentStats);
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command?.data) {
        client.commands.set(command.data.name, command);
      }
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('❌ Fehler beim Ausführen des Commands:', error);
    await interaction.reply({ content: 'Beim Ausführen des Commands ist ein Fehler aufgetreten!', ephemeral: true });
  }
});

// Fehlerbehandlung für Login
client.login(TOKEN).catch(error => {
  if (error.message.includes('An invalid token was provided')) {
    console.error('\n❌ Ungültiger Bot-Token!');
    console.error('👉 Bitte überprüfe deinen Token in der index.js und ersetze "YOURTOKEN" durch deinen echten Bot-Token.');
    console.error('👉 Stelle außerdem sicher, dass die GUILD_ID korrekt ist.');
    console.error('🔁 Starte den Bot anschließend neu.');
  } else {
    console.error('❌ Fehler beim Einloggen des Bots:', error);
  }
});
