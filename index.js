const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

function printIntroBox() {
  console.log(`
╔══════════════════════════════════════════════╗
║           🤖 Discord Bot Starter v1.0        ║
║      Entwickelt von hubi | Node.js + DJS     ║
║----------------------------------------------║
║ 📁  Commands-Ordner: ./commands               ║
║ 🔧  Deploy-Methode: Auto mit Change-Check     ║
║ 🌐  Status: Initialisierung läuft...          ║
╚══════════════════════════════════════════════╝
`);
}
printIntroBox();

const TOKEN = 'YourToken';
const GUILD_ID = 'YourToken';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandCachePath = path.join(__dirname, 'commands-cache.json');

// Ordner erstellen, falls nicht vorhanden
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
  console.log('📂 [Setup] Ordner "commands" wurde erstellt.');
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
async function deployCommands(commands) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('📦 [Deploy] Starte Command Deployment...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands },
    );
    console.log('🚀 [Deploy] Erfolgreich abgeschlossen!');
  } catch (error) {
    console.error('❌ [Deploy] Fehler beim Deployment:', error);
  }
}

// Command-Dateien validieren und laden
function loadValidCommands() {
  console.log('🔍 [Check] Lese Command-Dateien...');
  const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const validCommands = [];
  const currentStats = getCommandFileStats();

  for (const file of files) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command && command.data && typeof command.data.toJSON === 'function') {
        client.commands.set(command.data.name, command);
        validCommands.push(command.data.toJSON());
        console.log(`✅ [Geladen] ${file}`);
      } else {
        console.warn(`❌ [Fehler] ${file} ist ungültig oder leer`);
      }
    } catch (err) {
      console.warn(`❌ [Fehler] ${file} konnte nicht geladen werden: ${err.message}`);
    }
  }

  return { validCommands, currentStats };
}

// Beim Start
client.once('ready', async () => {
  console.log(`🤖 [Ready] Bot eingeloggt als ${client.user.tag}`);

  let cachedStats = null;
  if (fs.existsSync(commandCachePath)) {
    try {
      cachedStats = JSON.parse(fs.readFileSync(commandCachePath, 'utf8'));
    } catch {
      console.warn('⚠️ [Cache] Fehler beim Laden des Caches – Cache wird ignoriert.');
    }
  }

  const { validCommands, currentStats } = loadValidCommands();

  if (haveCommandsChanged(currentStats, cachedStats)) {
    console.log('📦 [Deploy] Änderungen erkannt – Commands werden deployed...');
    await deployCommands(validCommands);
    fs.writeFileSync(commandCachePath, JSON.stringify(currentStats, null, 2));
  } else {
    console.log('✅ [Deploy] Keine Änderungen erkannt – Deployment übersprungen.');
  }
});

// Interaction handling
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('❌ [Command] Fehler beim Ausführen:', error);
    await interaction.reply({ content: 'Beim Ausführen des Commands ist ein Fehler aufgetreten!', ephemeral: true });
  }
});

// Fehler beim Login
client.login(TOKEN).catch(error => {
  if (error.message.includes('An invalid token was provided')) {
    console.error('\n❌ [Login] Ungültiger Bot-Token!');
    console.error('👉 Bitte überprüfe den Token in der index.js ("YOURTOKEN").');
    console.error('👉 Ebenso GUILD_ID prüfen!');
    console.error('🔁 Starte den Bot anschließend neu.');
  } else {
    console.error('❌ [Login] Fehler beim Einloggen:', error);
  }
});
