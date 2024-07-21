/*
Discord Sopport https://dsc.gg/EchoScriptors
MIT License

Copyright (c) 2023 MonsterBunny

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/
/*.*/
require('dotenv').config();

const fs = require('fs');
const { Client, Intents, Collection } = require('discord.js');
const { Player } = require('discord-player');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const config = require('./config.json');
const settingsManager = require('./client/settingsManager.js');// 
// const { token } = require('./client/config.json');
const client = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS, 
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_MESSAGES
    ] 
});

client.commands = new Collection();
client.settings = settingsManager;

// Load command files
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// Initialize Player
const player = new Player(client);
player.extractors.loadDefault().then(() => console.log('Extractors loaded successfully'));

player.events.on('audioTrackAdd', (queue, song) => {
    queue.metadata.channel.send(`🎶 | Song **${song.title}** added to the queue!`);
});

player.events.on('playerStart', (queue, track) => {
    queue.metadata.channel.send(`▶ | Started playing: **${track.title}**!`);
});

player.events.on('audioTracksAdd', (queue) => {
    queue.metadata.channel.send(`🎶 | Tracks have been queued!`);
});

player.events.on('disconnect', (queue) => {
    queue.metadata.channel.send('❌ | I was manually disconnected from the voice channel, clearing queue!');
});

player.events.on('emptyChannel', (queue) => {
    queue.metadata.channel.send('❌ | Nobody is in the voice channel, leaving...');
});

player.events.on('emptyQueue', (queue) => {
    queue.metadata.channel.send('✅ | Queue finished!');
    queue.delete();
});

player.events.on('error', (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the connection: ${error.message}`);
});

// Client ready event
client.on('ready', () => {
    console.log('Ready!');
    client.user.presence.set({
        activities: [{ name: config.activity, type: Number(config.activityType) }],
        status: 'online',
    });
});

client.once('reconnecting', () => {
    console.log('Reconnecting!');
});

client.once('disconnect', () => {
    console.log('Disconnect!');
});

// Command handling
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!client.application?.owner) await client.application?.fetch();

    if (message.content === '!install' && message.author.id === client.application?.owner?.id) {
        await message.guild.commands
            .set(client.commands)
            .then(() => {
                message.reply('✅ Installed commands!');
            })
            .catch(err => {
                message.reply('❌ Could not deploy commands! Make sure the bot has the application.commands permission!');
                console.error(err);
            });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const command = client.commands.get(interaction.commandName.toLowerCase());

    if (!command) return;

    try {
        if (interaction.commandName === 'ban' || interaction.commandName === 'userinfo') {
            await command.execute(interaction, client);
        } else {
            await command.execute(interaction);
        }
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
        });
    }
});

// Voice state update handling
client.on('voiceStateUpdate', (oldState, newState) => {
    const connection = getVoiceConnection(newState.guild.id);
    if (connection && connection.joinConfig.channelId === oldState.channelId) {
        const guildId = oldState.guild.id;
        if (client.settings.get(guildId, '247', false) && oldState.channel.members.size === 1) {
            return; // Keep the bot in the channel
        }
        if (!client.settings.get(guildId, '247', false) && oldState.channel.members.size === 1) {
            connection.destroy(); // Disconnect the bot if 24/7 mode is off and channel is empty
        }
    }
});

client.login(process.env.TOKEN);
