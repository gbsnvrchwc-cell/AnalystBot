// src/register-commands.js
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const ANALYST_NAME = process.env.ANALYST_NAME || 'The Analyst';

const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription(`Ask ${ANALYST_NAME} a question based on their research & framework`)
    .addStringOption(opt =>
      opt.setName('question').setDescription('Your question').setRequired(true).setMaxLength(500)
    ),

  new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('Full options swing trade analysis for a ticker using your framework')
    .addStringOption(opt =>
      opt.setName('ticker').setDescription('Stock ticker (e.g. NVDA, PLTR, AAPL)').setRequired(true).setMaxLength(10)
    )
    .addStringOption(opt =>
      opt.setName('direction').setDescription('Trade direction').setRequired(false)
        .addChoices(
          { name: 'Bullish (Calls)', value: 'bullish' },
          { name: 'Bearish (Puts)',  value: 'bearish' },
          { name: 'Let the data decide', value: 'neutral' }
        )
    ),

  new SlashCommandBuilder()
    .setName('scan')
    .setDescription('Scan for trade opportunities across 4 modes')
    .addStringOption(opt =>
      opt.setName('mode').setDescription('What to scan for').setRequired(true)
        .addChoices(
          { name: '📅 Earnings Catalysts — upcoming earnings in 21 days',      value: 'earnings'  },
          { name: '🚀 Momentum — RSI + volume surge stocks right now',          value: 'momentum'  },
          { name: '🔥 Combined — earnings AND momentum filter together',        value: 'combined'  },
          { name: '🌐 Macro-Driven — Claude reads the market and picks plays',  value: 'macro'     }
        )
    ),

  new SlashCommandBuilder()
    .setName('scalp')
    .setDescription('Run through the MindEdge SPX scalping pre-trade checklist')
    .addStringOption(opt =>
      opt.setName('direction').setDescription('Trade direction').setRequired(true)
        .addChoices(
          { name: 'Long (Calls / Buy)',  value: 'long'  },
          { name: 'Short (Puts / Sell)', value: 'short' }
        )
    )
    .addStringOption(opt =>
      opt.setName('confluences').setDescription('Your confluences (e.g. EMA stack, Golden Pocket, BOS)').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('research')
    .setDescription('Show what research documents and frameworks are loaded'),

  new SlashCommandBuilder()
    .setName('analyst')
    .setDescription(`Learn about ${ANALYST_NAME} and their coverage`),

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function register() {
  console.log(`\nRegistering ${commands.length} slash commands...`);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log('✅ Commands registered globally\n');
    commands.forEach(c => console.log(`  /${c.name} — ${c.description}`));
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}
register();
