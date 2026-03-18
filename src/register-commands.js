// src/register-commands.js
// Run ONCE to register slash commands with Discord:
//   node src/register-commands.js

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const ANALYST_NAME = process.env.ANALYST_NAME || 'The Analyst';

const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription(`Ask ${ANALYST_NAME} a question based on their research`)
    .addStringOption(opt =>
      opt
        .setName('question')
        .setDescription('Your question for the analyst')
        .setRequired(true)
        .setMaxLength(500)
    ),

  new SlashCommandBuilder()
    .setName('research')
    .setDescription('Show what research documents the analyst has loaded'),

  new SlashCommandBuilder()
    .setName('analyst')
    .setDescription(`Learn about ${ANALYST_NAME} and their coverage focus`),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function register() {
  console.log(`\nRegistering ${commands.length} slash commands...`);

  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Commands registered globally (may take up to 1 hour to appear)');
    console.log('\nCommands registered:');
    commands.forEach(c => console.log(`  /${c.name} — ${c.description}`));
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
}

register();
