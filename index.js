```js
require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const { DisTube } = require("distube");
const { SoundCloudPlugin } = require("@distube/soundcloud");

// =========================
// EXPRESS
// =========================

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🎵 Discord Music Bot is online!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    bot: "music",
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// ENV
// =========================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error("❌ TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing.");
  process.exit(1);
}

// =========================
// DISCORD
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// =========================
// DISTUBE
// =========================

const distube = new DisTube(client, {
  plugins: [
    new SoundCloudPlugin(),
  ],
});

// =========================
// COMMANDS
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from SoundCloud")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("Song name or SoundCloud URL")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip current song"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music"),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause music"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume music"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show current song"),
].map((command) => command.toJSON());

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    console.log("🔄 Registering commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands,
      }
    );

    console.log("✅ Commands registered.");
  } catch (error) {
    console.error("❌ Command registration failed:");
    console.error(error);
  }
}

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log("================================");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log("🎵 Music bot ready");
  console.log("================================");

  await registerCommands();
});

// =========================
// INTERACTIONS
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  // ========================
  // PLAY
  // ========================

  if (command === "play") {
    const song = interaction.options.getString("song");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ Pehle voice channel join karo.",
        ephemeral: true,
      });
    }

    const permissions = voiceChannel.permissionsFor(client.user);

    if (!permissions?.has("Connect")) {
      return interaction.reply({
        content: "❌ Mere paas Connect permission nahi hai.",
        ephemeral: true,
      });
    }

    if (!permissions?.has("Speak")) {
      return interaction.reply({
        content: "❌ Mere paas Speak permission nahi hai.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      console.log("================================");
      console.log("🎵 PLAY REQUEST");
      console.log(`User: ${interaction.user.tag}`);
      console.log(`Search: ${song}`);
      console.log(`Channel: ${voiceChannel.name}`);
      console.log("================================");

      await distube.play(voiceChannel, song, {
        member: interaction.member,
        textChannel: interaction.channel,
      });

      await interaction.editReply(
        `🎵 Searching/playing: **${song}**`
      );

    } catch (error) {
      console.error("❌ PLAY ERROR:");
      console.error(error);

      await interaction.editReply(
        `❌ Music play nahi ho saki.\n\`${String(
          error.message || error
        ).slice(0, 1500)}\``
      );
    }
  }

  // ========================
  // SKIP
  // ========================

  else if (command === "skip") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("❌ Kuch play nahi ho raha.");
    }

    try {
      await queue.skip();
      await interaction.reply("⏭️ **Skipped!**");
    } catch (error) {
      await interaction.reply(
        `❌ Skip failed: ${error.message}`
      );
    }
  }

  // ========================
  // STOP
  // ========================

  else if (command === "stop") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("❌ Kuch play nahi ho raha.");
    }

    try {
      queue.stop();
      await interaction.reply("⏹️ **Music stopped.**");
    } catch (error) {
      await interaction.reply(
        `❌ Stop failed: ${error.message}`
      );
    }
  }

  // ========================
  // PAUSE
  // ========================

  else if (command === "pause") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("❌ Kuch play nahi ho raha.");
    }

    try {
      if (queue.paused) {
        return interaction.reply("⏸️ Already paused hai.");
      }

      queue.pause();

      await interaction.reply("⏸️ **Paused.**");
    } catch (error) {
      await interaction.reply(
        `❌ Pause failed: ${error.message}`
      );
    }
  }

  // ========================
  // RESUME
  // ========================

  else if (command === "resume") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("❌ Kuch play nahi ho raha.");
    }

    try {
      if (!queue.paused) {
        return interaction.reply("▶️ Already playing hai.");
      }

      queue.resume();

      await interaction.reply("▶️ **Resumed.**");
    } catch (error) {
      await interaction.reply(
        `❌ Resume failed: ${error.message}`
      );
    }
  }

  // ========================
  // QUEUE
  // ========================

  else if (command === "queue") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue || !queue.songs.length) {
      return interaction.reply("📭 Queue empty hai.");
    }

    let message = "🎵 **Music Queue**\n\n";

    queue.songs.slice(0, 10).forEach((song, index) => {
      if (index === 0) {
        message += `▶️ **Now:** ${song.name}\n`;
      } else {
        message += `${index}. ${song.name}\n`;
      }
    });

    if (queue.songs.length > 10) {
      message += `\n...and ${
        queue.songs.length - 10
      } more.`;
    }

    await interaction.reply(message);
  }

  // ========================
  // NOW PLAYING
  // ========================

  else if (command === "nowplaying") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue || !queue.songs.length) {
      return interaction.reply(
        "📭 Abhi kuch play nahi ho raha."
      );
    }

    const song = queue.songs[0];

    await interaction.reply(
      `🎵 **Now Playing**\n\n` +
      `**${song.name}**\n` +
      `⏱️ ${song.formattedDuration || "Unknown"}`
    );
  }
});

// =========================
// EVENTS
// =========================

distube.on("playSong", (queue, song) => {
  console.log("================================");
  console.log("🎵 NOW PLAYING");
  console.log(`🎶 ${song.name}`);
  console.log(`⏱️ ${song.formattedDuration}`);
  console.log("================================");

  if (queue.textChannel) {
    queue.textChannel
      .send(`🎵 **Now Playing:** ${song.name}`)
      .catch(() => {});
  }
});

distube.on("addSong", (queue, song) => {
  console.log(`➕ Added: ${song.name}`);
});

distube.on("addList", (queue, playlist) => {
  console.log(`📃 Playlist: ${playlist.name}`);
});

distube.on("finish", () => {
  console.log("🏁 Queue finished.");
});

distube.on("empty", () => {
  console.log("🔊 Voice channel empty.");
});

distube.on("error", (channel, error) => {
  console.error("================================");
  console.error("❌ DISTUBE ERROR");
  console.error(error);
  console.error("================================");
});

distube.on("debug", (message) => {
  console.log(`[DisTube] ${message}`);
});

// =========================
// LOGIN
// =========================

client.login(TOKEN).catch((error) => {
  console.error("❌ Discord login failed:");
  console.error(error);
});
```
