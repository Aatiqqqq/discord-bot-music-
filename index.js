require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");

const app = express();

app.get("/", (req, res) => {
  res.send("✅ Discord Music Bot is Online!");
});

app.listen(3000, () => console.log("Web server running"));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.distube = new DisTube(client, {
  plugins: [new SpotifyPlugin()]
});

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music")
    .addStringOption(o =>
      o.setName("song").setDescription("Song name").setRequired(true)
    ),
  new SlashCommandBuilder().setName("skip").setDescription("Skip"),
  new SlashCommandBuilder().setName("stop").setDescription("Stop"),
  new SlashCommandBuilder().setName("pause").setDescription("Pause"),
  new SlashCommandBuilder().setName("resume").setDescription("Resume")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log("Slash commands registered");
})();

client.on("ready", () => console.log("Bot online!"));

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const voice = interaction.member.voice.channel;
  if (!voice) return interaction.reply("Join voice first!");

  try {
    if (interaction.commandName === "play") {
      const song = interaction.options.getString("song");
      await client.distube.play(voice, song, { member: interaction.member });
      interaction.reply(`🎵 Playing ${song}`);
    }

    if (interaction.commandName === "skip") {
      client.distube.skip(interaction.guildId);
      interaction.reply("Skipped");
    }

    if (interaction.commandName === "stop") {
      client.distube.stop(interaction.guildId);
      interaction.reply("Stopped");
    }

    if (interaction.commandName === "pause") {
      client.distube.pause(interaction.guildId);
      interaction.reply("Paused");
    }

    if (interaction.commandName === "resume") {
      client.distube.resume(interaction.guildId);
      interaction.reply("Resumed");
    }

  } catch (err) {
    console.error(err);
    interaction.reply("Music error");
  }
});

client.login(process.env.TOKEN);
