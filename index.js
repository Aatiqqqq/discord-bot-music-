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
const { SpotifyPlugin } = require("@tireoz/spotify");

// =========================
// EXPRESS SERVER
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
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// ENVIRONMENT
// =========================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error("❌ TOKEN environment variable is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID environment variable is missing.");
  process.exit(1);
}

// =========================
// DISCORD CLIENT
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
    new SpotifyPlugin(),
  ],
});

// =========================
// SLASH COMMANDS
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or Spotify/SoundCloud link")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("Song name or music link")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music and leave voice channel"),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause the current song"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume the current song"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the music queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the current song"),
].map((command) => command.toJSON());

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Command registration error:");
    console.error(error);
  }
}

// =========================
// BOT READY
// =========================

client.once("ready", async () => {
  console.log("=================================");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🆔 Bot ID: ${client.user.id}`);
  console.log("🎵 Music system ready");
  console.log("=================================");

  await registerCommands();
});

// =========================
// /PLAY
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  // -------------------------
  // PLAY
  // -------------------------

  if (command === "play") {
    const song = interaction.options.getString("song");

    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ Pehle kisi voice channel mein join karo.",
        ephemeral: true,
      });
    }

    const permissions = voiceChannel.permissionsFor(client.user);

    if (!permissions?.has("Connect")) {
      return interaction.reply({
        content: "❌ Mere paas **Connect** permission nahi hai.",
        ephemeral: true,
      });
    }

    if (!permissions?.has("Speak")) {
      return interaction.reply({
        content: "❌ Mere paas **Speak** permission nahi hai.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      console.log("=================================");
      console.log("🎵 PLAY REQUEST");
      console.log(`👤 User: ${interaction.user.tag}`);
      console.log(`🔎 Search: ${song}`);
      console.log(`🔊 Channel: ${voiceChannel.name}`);
      console.log("=================================");

      await distube.play(voiceChannel, song, {
        member: interaction.member,
        textChannel: interaction.channel,
      });

      await interaction.editReply(
        `🎵 **Requested:** ${song}`
      );

    } catch (error) {
      console.error("❌ PLAY ERROR:");
      console.error(error);

      const message =
        error?.message ||
        "Music play karte waqt unknown error aa gaya.";

      await interaction.editReply(
        `❌ **Music play nahi ho saki.**\n\`${message.slice(0, 1500)}\``
      );
    }
  }

  // -------------------------
  // SKIP
  // -------------------------

  else if (command === "skip") {
    try {
      const queue = distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply("❌ Abhi koi music nahi chal raha.");
      }

      await queue.skip();

      await interaction.reply("⏭️ **Skipped!**");
    } catch (error) {
      console.error(error);

      await interaction.reply(
        `❌ Skip nahi ho saka: ${error.message}`
      );
    }
  }

  // -------------------------
  // STOP
  // -------------------------

  else if (command === "stop") {
    try {
      const queue = distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply("❌ Abhi koi music nahi chal raha.");
      }

      queue.stop();

      await interaction.reply("⏹️ **Music stopped.**");
    } catch (error) {
      console.error(error);

      await interaction.reply(
        `❌ Stop nahi ho saka: ${error.message}`
      );
    }
  }

  // -------------------------
  // PAUSE
  // -------------------------

  else if (command === "pause") {
    try {
      const queue = distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply("❌ Abhi koi music nahi chal raha.");
      }

      if (queue.paused) {
        return interaction.reply("⏸️ Music already paused hai.");
      }

      queue.pause();

      await interaction.reply("⏸️ **Music paused.**");
    } catch (error) {
      console.error(error);

      await interaction.reply(
        `❌ Pause nahi ho saka: ${error.message}`
      );
    }
  }

  // -------------------------
  // RESUME
  // -------------------------

  else if (command === "resume") {
    try {
      const queue = distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply("❌ Abhi koi music nahi chal raha.");
      }

      if (!queue.paused) {
        return interaction.reply("▶️ Music already playing hai.");
      }

      queue.resume();

      await interaction.reply("▶️ **Music resumed.**");
    } catch (error) {
      console.error(error);

      await interaction.reply(
        `❌ Resume nahi ho saka: ${error.message}`
      );
    }
  }

  // -------------------------
  // QUEUE
  // -------------------------

  else if (command === "queue") {
    try {
      const queue = distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply("📭 Queue empty hai.");
      }

      const songs = queue.songs;

      let text = "🎵 **Music Queue**\n\n";

      songs.slice(0, 10).forEach((song, index) => {
        if (index === 0) {
          text += `▶️ **Now:** ${song.name}\n`;
        } else {
          text += `${index}. ${song.name}\n`;
        }
      });

      if (songs.length > 10) {
        text += `\n...and ${songs.length - 10} more.`;
      }

      await interaction.reply(text);
    } catch (error) {
      console.error(error);

      await interaction.reply(
        `❌ Queue nahi mil saki: ${error.message}`
      );
    }
  }

  // -------------------------
  // NOW PLAYING
  // -------------------------

  else if (command === "nowplaying") {
    try {
      const queue = distube.getQueue(interaction.guildId);

      if (!queue || !queue.songs.length) {
        return interaction.reply("📭 Abhi kuch play nahi ho raha.");
      }

      const song = queue.songs[0];

      await interaction.reply(
        `🎵 **Now Playing**\n\n` +
        `**${song.name}**\n` +
        `⏱️ ${song.formattedDuration || "Unknown"}`
      );
    } catch (error) {
      console.error(error);

      await interaction.reply(
        `❌ Current song nahi mil saki: ${error.message}`
      );
    }
  }
});

// =========================
// DISTUBE EVENTS
// =========================

distube.on("playSong", (queue, song) => {
  console.log("=================================");
  console.log("🎵 NOW PLAYING");
  console.log(`🎶 ${song.name}`);
  console.log(`⏱️ ${song.formattedDuration}`);
  console.log(`🌐 ${song.url}`);
  console.log("=================================");

  if (queue.textChannel) {
    queue.textChannel.send(
      `🎵 **Now Playing:** ${song.name}`
    ).catch(() => {});
  }
});

distube.on("addSong", (queue, song) => {
  console.log(`➕ Added: ${song.name}`);
});

distube.on("addList", (queue, playlist) => {
  console.log(`📃 Playlist added: ${playlist.name}`);
});

distube.on("finish", (queue) => {
  console.log("🏁 Queue finished.");
});

distube.on("empty", (queue) => {
  console.log("🔊 Voice channel empty.");
});

distube.on("error", (channel, error) => {
  console.error("=================================");
  console.error("❌ DISTUBE ERROR");
  console.error(error);
  console.error("=================================");
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
