require("dotenv").config();

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { YtDlpPlugin } = require("@distube/yt-dlp");

// ==================================================
// ENVIRONMENT VARIABLES
// ==================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error("❌ TOKEN is missing!");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing!");
  process.exit(1);
}

// ==================================================
// EXPRESS SERVER - RENDER
// ==================================================

const app = express();

app.get("/", (req, res) => {
  res.send("🎵 Music Bot is Online!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    bot: client?.user?.tag || "starting"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ==================================================
// DISCORD CLIENT
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ==================================================
// DISTUBE
// ==================================================

const distube = new DisTube(client, {
  plugins: [
    new SpotifyPlugin(),

    // IMPORTANT:
    // yt-dlp plugin must be last
    new YtDlpPlugin({
      update: true
    })
  ]
});

// ==================================================
// SLASH COMMANDS
// ==================================================

const commands = [

  new SlashCommandBuilder()
    .setName("play")
    .setDescription("🎵 Play music")
    .addStringOption(option =>
      option
        .setName("song")
        .setDescription("Song name or music URL")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("⏭️ Skip current song"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("⏹️ Stop music"),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("⏸️ Pause music"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("▶️ Resume music"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("📜 Show music queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("🎶 Show current song")

].map(command => command.toJSON());

// ==================================================
// REGISTER COMMANDS
// ==================================================

async function registerCommands() {

  try {

    console.log("🔄 Registering slash commands...");

    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("✅ Slash commands registered!");

  } catch (error) {

    console.error("❌ COMMAND REGISTRATION ERROR:");
    console.error(error);

  }

}

// ==================================================
// BOT READY
// ==================================================

client.once("ready", async () => {

  console.log("================================");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log("🎵 Music system loaded");
  console.log("================================");

  client.user.setActivity("/play | Music", {
    type: 2
  });

  await registerCommands();

});

// ==================================================
// INTERACTION HANDLER
// ==================================================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) {
    return;
  }

  // ==================================================
  // VOICE CHANNEL CHECK
  // ==================================================

  const voiceChannel =
    interaction.member?.voice?.channel;

  if (!voiceChannel) {

    return interaction.reply({
      content: "❌ **Pehle voice channel join karo!**",
      ephemeral: true
    });

  }

  try {

    // ==================================================
    // PLAY
    // ==================================================

    if (interaction.commandName === "play") {

      const song =
        interaction.options.getString("song");

      await interaction.deferReply();

      console.log("================================");
      console.log("🎵 PLAY REQUEST");
      console.log(`🔎 Query: ${song}`);
      console.log(`👤 User: ${interaction.user.tag}`);
      console.log(`🔊 Voice: ${voiceChannel.name}`);
      console.log("================================");

      await distube.play(
        voiceChannel,
        song,
        {
          member: interaction.member,
          textChannel: interaction.channel
        }
      );

      await interaction.editReply(
        `🔎 **Searching:** ${song}`
      );

      return;
    }

    // ==================================================
    // SKIP
    // ==================================================

    if (interaction.commandName === "skip") {

      const queue =
        distube.getQueue(interaction.guildId);

      if (!queue) {

        return interaction.reply({
          content: "❌ Nothing is playing.",
          ephemeral: true
        });

      }

      await distube.skip(interaction.guildId);

      return interaction.reply(
        "⏭️ **Skipped!**"
      );
    }

    // ==================================================
    // STOP
    // ==================================================

    if (interaction.commandName === "stop") {

      const queue =
        distube.getQueue(interaction.guildId);

      if (!queue) {

        return interaction.reply({
          content: "❌ Nothing is playing.",
          ephemeral: true
        });

      }

      await distube.stop(interaction.guildId);

      return interaction.reply(
        "⏹️ **Music stopped. Queue cleared.**"
      );
    }

    // ==================================================
    // PAUSE
    // ==================================================

    if (interaction.commandName === "pause") {

      const queue =
        distube.getQueue(interaction.guildId);

      if (!queue) {

        return interaction.reply({
          content: "❌ Nothing is playing.",
          ephemeral: true
        });

      }

      if (queue.paused) {

        return interaction.reply({
          content: "⏸️ Already paused.",
          ephemeral: true
        });

      }

      await distube.pause(interaction.guildId);

      return interaction.reply(
        "⏸️ **Paused!**"
      );
    }

    // ==================================================
    // RESUME
    // ==================================================

    if (interaction.commandName === "resume") {

      const queue =
        distube.getQueue(interaction.guildId);

      if (!queue) {

        return interaction.reply({
          content: "❌ Nothing is playing.",
          ephemeral: true
        });

      }

      if (!queue.paused) {

        return interaction.reply({
          content: "▶️ Already playing.",
          ephemeral: true
        });

      }

      await distube.resume(interaction.guildId);

      return interaction.reply(
        "▶️ **Resumed!**"
      );
    }

    // ==================================================
    // QUEUE
    // ==================================================

    if (interaction.commandName === "queue") {

      const queue =
        distube.getQueue(interaction.guildId);

      if (!queue) {

        return interaction.reply({
          content: "📭 Queue is empty.",
          ephemeral: true
        });

      }

      let text = "";

      queue.songs
        .slice(0, 10)
        .forEach((song, index) => {

          if (index === 0) {

            text +=
              `🎵 **Now:** ${song.name}\n\n`;

          } else {

            text +=
              `${index}. ${song.name}\n`;

          }

        });

      const embed =
        new EmbedBuilder()
          .setTitle("🎵 Music Queue")
          .setDescription(text || "Queue is empty.")
          .setColor(0x5865F2);

      return interaction.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // NOW PLAYING
    // ==================================================

    if (interaction.commandName === "nowplaying") {

      const queue =
        distube.getQueue(interaction.guildId);

      if (!queue) {

        return interaction.reply({
          content: "📭 Nothing is playing.",
          ephemeral: true
        });

      }

      const song =
        queue.songs[0];

      const embed =
        new EmbedBuilder()
          .setTitle("🎶 Now Playing")
          .setDescription(`**${song.name}**`)
          .addFields({
            name: "⏱️ Duration",
            value:
              song.formattedDuration ||
              "Unknown",
            inline: true
          })
          .setColor(0x5865F2);

      if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
      }

      if (song.url) {
        embed.setURL(song.url);
      }

      return interaction.reply({
        embeds: [embed]
      });
    }

  } catch (error) {

    console.error("================================");
    console.error("❌ PLAYBACK ERROR");
    console.error(error);
    console.error("================================");

    let message =
      "❌ **Music error occurred.**";

    if (error?.message) {

      message +=
        `\n\`\`\`\n${error.message.slice(0, 1500)}\n\`\`\``;

    }

    if (interaction.deferred) {

      await interaction
        .editReply(message)
        .catch(() => {});

    } else if (!interaction.replied) {

      await interaction
        .reply({
          content: message,
          ephemeral: true
        })
        .catch(() => {});

    }

  }

});

// ==================================================
// DISTUBE - PLAY SONG
// ==================================================

distube.on("playSong", (queue, song) => {

  console.log("================================");
  console.log("🎵 NOW PLAYING");
  console.log(`🎶 ${song.name}`);
  console.log(`🔗 ${song.url || "No URL"}`);
  console.log("================================");

  if (!queue.textChannel) {
    return;
  }

  const embed =
    new EmbedBuilder()
      .setTitle("🎵 Now Playing")
      .setDescription(`**${song.name}**`)
      .setColor(0x57F287);

  if (song.thumbnail) {
    embed.setThumbnail(song.thumbnail);
  }

  queue.textChannel
    .send({
      embeds: [embed]
    })
    .catch(() => {});

});

// ==================================================
// DISTUBE - ADD SONG
// ==================================================

distube.on("addSong", (queue, song) => {

  console.log("➕ SONG ADDED");
  console.log(song.name);

  if (!queue.textChannel) {
    return;
  }

  queue.textChannel
    .send(
      `➕ **Added to queue:** ${song.name}`
    )
    .catch(() => {});

});

// ==================================================
// DISTUBE - PLAYLIST
// ==================================================

distube.on("addList", (queue, playlist) => {

  console.log("📚 PLAYLIST ADDED");
  console.log(playlist.name);

  if (!queue.textChannel) {
    return;
  }

  queue.textChannel
    .send(
      `📚 **Playlist added:** ${playlist.name}\n` +
      `🎵 ${playlist.songs.length} songs`
    )
    .catch(() => {});

});

// ==================================================
// DISTUBE - FINISH
// ==================================================

distube.on("finish", queue => {

  console.log("✅ QUEUE FINISHED");

  if (!queue.textChannel) {
    return;
  }

  queue.textChannel
    .send("✅ **Queue finished!**")
    .catch(() => {});

});

// ==================================================
// DISTUBE - EMPTY
// ==================================================

distube.on("empty", queue => {

  console.log("👋 VOICE CHANNEL EMPTY");

  if (!queue.textChannel) {
    return;
  }

  queue.textChannel
    .send(
      "👋 **Everyone left the voice channel.**"
    )
    .catch(() => {});

});

// ==================================================
// DISTUBE ERROR
// ==================================================

distube.on("error", (channel, error) => {

  console.error("================================");
  console.error("❌ DISTUBE ERROR");
  console.error(error);
  console.error("================================");

  if (channel) {

    channel
      .send(
        `❌ **Music error:**\n\`\`\`\n${
          error?.message || error
        }\n\`\`\``
      )
      .catch(() => {});

  }

});

// ==================================================
// DISCORD ERROR
// ==================================================

client.on("error", error => {

  console.error("❌ DISCORD ERROR:");
  console.error(error);

});

// ==================================================
// UNHANDLED ERRORS
// ==================================================

process.on("unhandledRejection", error => {

  console.error("❌ UNHANDLED REJECTION:");
  console.error(error);

});

process.on("uncaughtException", error => {

  console.error("❌ UNCAUGHT EXCEPTION:");
  console.error(error);

});

// ==================================================
// LOGIN
// ==================================================

client.login(TOKEN);
