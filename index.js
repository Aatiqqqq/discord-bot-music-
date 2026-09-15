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

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// =====================================================
// BASIC CHECKS
// =====================================================

if (!TOKEN) {
  console.error("❌ TOKEN is missing from Environment Variables.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing from Environment Variables.");
  process.exit(1);
}

// =====================================================
// EXPRESS SERVER - REQUIRED FOR RENDER
// =====================================================

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("🎵 Discord Music Bot is Online!");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "online",
    bot: client.user ? client.user.tag : "starting"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =====================================================
// DISTUBE
// =====================================================

client.distube = new DisTube(client, {
  emitNewSongOnly: true,

  plugins: [
    new SpotifyPlugin(),
    new YtDlpPlugin()
  ]
});

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

  new SlashCommandBuilder()
    .setName("play")
    .setDescription("🎵 Play a song")
    .addStringOption(option =>
      option
        .setName("song")
        .setDescription("Song name, YouTube URL or Spotify URL")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("⏭️ Skip the current song"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("⏹️ Stop music and clear queue"),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("⏸️ Pause the music"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("▶️ Resume the music"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("📜 Show the music queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("🎶 Show the currently playing song")

].map(command => command.toJSON());

// =====================================================
// REGISTER SLASH COMMANDS
// =====================================================

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("✅ Slash commands registered successfully.");
  } catch (error) {
    console.error("❌ Failed to register slash commands:");
    console.error(error);
  }
}

// =====================================================
// BOT READY
// =====================================================

client.once("ready", async () => {
  console.log("====================================");
  console.log(`🤖 Bot Online: ${client.user.tag}`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log("🎵 Music system ready");
  console.log("====================================");

  client.user.setActivity("/play | Music", {
    type: 2
  });

  await registerCommands();
});

// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  // ---------------------------------------------------
  // VOICE CHANNEL CHECK
  // ---------------------------------------------------

  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply({
      content: "❌ **Pehle voice channel join karo!**",
      ephemeral: true
    });
  }

  // ---------------------------------------------------
  // PLAY
  // ---------------------------------------------------

  if (command === "play") {

    const song = interaction.options.getString("song");

    try {

      await interaction.deferReply();

      await client.distube.play(
        voiceChannel,
        song,
        {
          member: interaction.member,
          textChannel: interaction.channel
        }
      );

      await interaction.editReply(
        `🎵 **Request received!**\n🔎 ${song}`
      );

    } catch (error) {

      console.error("PLAY ERROR:");
      console.error(error);

      if (interaction.deferred) {
        await interaction.editReply(
          "❌ **Song play nahi ho paya.**\nTry another song name or URL."
        );
      } else {
        await interaction.reply(
          "❌ **Song play nahi ho paya.**"
        );
      }
    }

    return;
  }

  // ---------------------------------------------------
  // SKIP
  // ---------------------------------------------------

  if (command === "skip") {

    try {

      const queue = client.distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply({
          content: "❌ Abhi koi music nahi chal raha.",
          ephemeral: true
        });
      }

      await client.distube.skip(interaction.guildId);

      return interaction.reply("⏭️ **Skipped!**");

    } catch (error) {

      console.error("SKIP ERROR:");
      console.error(error);

      return interaction.reply({
        content: "❌ Skip nahi ho paya.",
        ephemeral: true
      });
    }
  }

  // ---------------------------------------------------
  // STOP
  // ---------------------------------------------------

  if (command === "stop") {

    try {

      const queue = client.distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply({
          content: "❌ Abhi koi music nahi chal raha.",
          ephemeral: true
        });
      }

      await client.distube.stop(interaction.guildId);

      return interaction.reply("⏹️ **Music stopped aur queue clear ho gayi.**");

    } catch (error) {

      console.error("STOP ERROR:");
      console.error(error);

      return interaction.reply({
        content: "❌ Music stop nahi ho paya.",
        ephemeral: true
      });
    }
  }

  // ---------------------------------------------------
  // PAUSE
  // ---------------------------------------------------

  if (command === "pause") {

    try {

      const queue = client.distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply({
          content: "❌ Abhi koi music nahi chal raha.",
          ephemeral: true
        });
      }

      if (queue.paused) {
        return interaction.reply({
          content: "⏸️ Music already paused hai.",
          ephemeral: true
        });
      }

      await client.distube.pause(interaction.guildId);

      return interaction.reply("⏸️ **Music paused!**");

    } catch (error) {

      console.error("PAUSE ERROR:");
      console.error(error);

      return interaction.reply({
        content: "❌ Music pause nahi ho paya.",
        ephemeral: true
      });
    }
  }

  // ---------------------------------------------------
  // RESUME
  // ---------------------------------------------------

  if (command === "resume") {

    try {

      const queue = client.distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply({
          content: "❌ Abhi koi music queue nahi hai.",
          ephemeral: true
        });
      }

      if (!queue.paused) {
        return interaction.reply({
          content: "▶️ Music already playing hai.",
          ephemeral: true
        });
      }

      await client.distube.resume(interaction.guildId);

      return interaction.reply("▶️ **Music resumed!**");

    } catch (error) {

      console.error("RESUME ERROR:");
      console.error(error);

      return interaction.reply({
        content: "❌ Music resume nahi ho paya.",
        ephemeral: true
      });
    }
  }

  // ---------------------------------------------------
  // QUEUE
  // ---------------------------------------------------

  if (command === "queue") {

    try {

      const queue = client.distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply({
          content: "📭 **Queue empty hai.**",
          ephemeral: true
        });
      }

      const currentSong = queue.songs[0];

      let description =
        `🎵 **Now Playing:**\n${currentSong.name}\n\n`;

      if (queue.songs.length > 1) {

        description += "📜 **Up Next:**\n";

        queue.songs
          .slice(1, 11)
          .forEach((song, index) => {
            description +=
              `${index + 1}. ${song.name}\n`;
          });

      } else {

        description += "📭 **Queue mein aur songs nahi hain.**";
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎵 Music Queue")
        .setDescription(description)
        .setFooter({
          text: `${queue.songs.length} song(s) in queue`
        });

      return interaction.reply({
        embeds: [embed]
      });

    } catch (error) {

      console.error("QUEUE ERROR:");
      console.error(error);

      return interaction.reply({
        content: "❌ Queue load nahi ho payi.",
        ephemeral: true
      });
    }
  }

  // ---------------------------------------------------
  // NOW PLAYING
  // ---------------------------------------------------

  if (command === "nowplaying") {

    try {

      const queue = client.distube.getQueue(interaction.guildId);

      if (!queue) {
        return interaction.reply({
          content: "📭 Abhi kuch play nahi ho raha.",
          ephemeral: true
        });
      }

      const song = queue.songs[0];

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎶 Now Playing")
        .setDescription(`**${song.name}**`)
        .addFields(
          {
            name: "⏱️ Duration",
            value: song.formattedDuration || "Unknown",
            inline: true
          },
          {
            name: "👤 Requested By",
            value: song.user
              ? `<@${song.user.id}>`
              : "Unknown",
            inline: true
          }
        );

      if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
      }

      if (song.url) {
        embed.setURL(song.url);
      }

      return interaction.reply({
        embeds: [embed]
      });

    } catch (error) {

      console.error("NOW PLAYING ERROR:");
      console.error(error);

      return interaction.reply({
        content: "❌ Current song information nahi mil saki.",
        ephemeral: true
      });
    }
  }
});

// =====================================================
// DISTUBE EVENTS
// =====================================================

client.distube
  .on("playSong", (queue, song) => {

    console.log(
      `🎵 Playing: ${song.name} in ${queue.voiceChannel?.name || "Voice Channel"}`
    );

    if (queue.textChannel) {

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🎵 Now Playing")
        .setDescription(`**${song.name}**`)
        .addFields({
          name: "⏱️ Duration",
          value: song.formattedDuration || "Unknown",
          inline: true
        });

      if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
      }

      if (song.url) {
        embed.setURL(song.url);
      }

      queue.textChannel
        .send({ embeds: [embed] })
        .catch(() => {});
    }
  })

  .on("addSong", (queue, song) => {

    console.log(`➕ Added to queue: ${song.name}`);

    if (queue.textChannel) {

      queue.textChannel
        .send(`➕ **Added to queue:** ${song.name}`)
        .catch(() => {});
    }
  })

  .on("addList", (queue, playlist) => {

    console.log(
      `📚 Playlist added: ${playlist.name}`
    );

    if (queue.textChannel) {

      queue.textChannel
        .send(
          `📚 **Playlist added:** ${playlist.name}\n` +
          `🎵 ${playlist.songs.length} songs`
        )
        .catch(() => {});
    }
  })

  .on("finish", queue => {

    console.log("✅ Queue finished.");

    if (queue.textChannel) {
      queue.textChannel
        .send("✅ **Queue finished!**")
        .catch(() => {});
    }
  })

  .on("empty", queue => {

    console.log("👋 Voice channel empty.");

    if (queue.textChannel) {
      queue.textChannel
        .send("👋 **Everyone left the voice channel.**")
        .catch(() => {});
    }
  })

  .on("error", (channel, error) => {

    console.error("DISTUBE ERROR:");
    console.error(error);

    if (channel) {
      channel
        .send("❌ **Music error:** Song play nahi ho paya.")
        .catch(() => {});
    }
  });

// =====================================================
// DISCORD ERRORS
// =====================================================

client.on("error", error => {
  console.error("DISCORD CLIENT ERROR:");
  console.error(error);
});

process.on("unhandledRejection", error => {
  console.error("UNHANDLED PROMISE REJECTION:");
  console.error(error);
});

process.on("uncaughtException", error => {
  console.error("UNCAUGHT EXCEPTION:");
  console.error(error);
});

// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
