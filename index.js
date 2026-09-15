require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { DisTube } = require("distube");
const { SoundCloudPlugin } = require("@distube/soundcloud");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Discord Music Bot is online!");
});

app.get("/health", (req, res) => {
  res.json({ status: "online" });
});

app.listen(PORT, () => {
  console.log("Web server running on port " + PORT);
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error("TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("CLIENT_ID is missing.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const distube = new DisTube(client, {
  plugins: [
    new SoundCloudPlugin()
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from SoundCloud")
    .addStringOption(option =>
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
    .setDescription("Show music queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show current song")
].map(command => command.toJSON());

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Command registration error:");
    console.error(error);
  }
}

client.once("ready", async () => {
  console.log("--------------------------------");
  console.log("Logged in as " + client.user.tag);
  console.log("Music bot is ready.");
  console.log("--------------------------------");

  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = interaction.commandName;

  if (command === "play") {
    const song = interaction.options.getString("song");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "Pehle voice channel join karo.",
        ephemeral: true
      });
    }

    const permissions = voiceChannel.permissionsFor(client.user);

    if (!permissions || !permissions.has("Connect")) {
      return interaction.reply({
        content: "Mere paas Connect permission nahi hai.",
        ephemeral: true
      });
    }

    if (!permissions.has("Speak")) {
      return interaction.reply({
        content: "Mere paas Speak permission nahi hai.",
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      console.log("--------------------------------");
      console.log("PLAY REQUEST");
      console.log("User: " + interaction.user.tag);
      console.log("Song: " + song);
      console.log("Channel: " + voiceChannel.name);
      console.log("--------------------------------");

      await distube.play(voiceChannel, song, {
        member: interaction.member,
        textChannel: interaction.channel
      });

      await interaction.editReply(
        "Searching/playing: **" + song + "**"
      );

    } catch (error) {
      console.error("PLAY ERROR:");
      console.error(error);

      const errorMessage = String(
        error && error.message ? error.message : error
      );

      await interaction.editReply(
        "Music play nahi ho saki.\n```" +
        errorMessage.slice(0, 1500) +
        "```"
      );
    }

    return;
  }

  if (command === "skip") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("Kuch play nahi ho raha.");
    }

    try {
      await queue.skip();
      await interaction.reply("Skipped!");
    } catch (error) {
      await interaction.reply(
        "Skip failed: " + error.message
      );
    }

    return;
  }

  if (command === "stop") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("Kuch play nahi ho raha.");
    }

    try {
      queue.stop();
      await interaction.reply("Music stopped.");
    } catch (error) {
      await interaction.reply(
        "Stop failed: " + error.message
      );
    }

    return;
  }

  if (command === "pause") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("Kuch play nahi ho raha.");
    }

    try {
      if (queue.paused) {
        return interaction.reply("Music already paused hai.");
      }

      queue.pause();
      await interaction.reply("Music paused.");
    } catch (error) {
      await interaction.reply(
        "Pause failed: " + error.message
      );
    }

    return;
  }

  if (command === "resume") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply("Kuch play nahi ho raha.");
    }

    try {
      if (!queue.paused) {
        return interaction.reply("Music already playing hai.");
      }

      queue.resume();
      await interaction.reply("Music resumed.");
    } catch (error) {
      await interaction.reply(
        "Resume failed: " + error.message
      );
    }

    return;
  }

  if (command === "queue") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue || !queue.songs.length) {
      return interaction.reply("Queue empty hai.");
    }

    let message = "**Music Queue**\n\n";

    queue.songs.slice(0, 10).forEach((song, index) => {
      if (index === 0) {
        message += "Now: **" + song.name + "**\n";
      } else {
        message += index + ". " + song.name + "\n";
      }
    });

    if (queue.songs.length > 10) {
      message +=
        "\n...and " +
        (queue.songs.length - 10) +
        " more.";
    }

    await interaction.reply(message);
    return;
  }

  if (command === "nowplaying") {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue || !queue.songs.length) {
      return interaction.reply(
        "Abhi kuch play nahi ho raha."
      );
    }

    const song = queue.songs[0];

    await interaction.reply(
      "**Now Playing**\n\n" +
      "**" + song.name + "**\n" +
      "Duration: " +
      (song.formattedDuration || "Unknown")
    );

    return;
  }
});

distube.on("playSong", (queue, song) => {
  console.log("--------------------------------");
  console.log("NOW PLAYING");
  console.log(song.name);
  console.log(song.formattedDuration || "");
  console.log("--------------------------------");

  if (queue.textChannel) {
    queue.textChannel
      .send("Now Playing: **" + song.name + "**")
      .catch(() => {});
  }
});

distube.on("addSong", (queue, song) => {
  console.log("Added: " + song.name);
});

distube.on("addList", (queue, playlist) => {
  console.log("Playlist added: " + playlist.name);
});

distube.on("finish", () => {
  console.log("Queue finished.");
});

distube.on("empty", () => {
  console.log("Voice channel empty.");
});

distube.on("error", (channel, error) => {
  console.error("--------------------------------");
  console.error("DISTUBE ERROR");
  console.error(error);
  console.error("--------------------------------");
});

client.login(TOKEN).catch(error => {
  console.error("Discord login failed:");
  console.error(error);
});
