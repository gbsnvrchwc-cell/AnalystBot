// src/index.js
// Main Discord bot entry point

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
} from 'discord.js';
import { getAnalystResponse, getStoreHealth } from './analyst.js';

const ANALYST_NAME  = process.env.ANALYST_NAME  || 'The Analyst';
const ANALYST_TITLE = process.env.ANALYST_TITLE || 'Senior Analyst';
const ANALYST_FIRM  = process.env.ANALYST_FIRM  || 'Research Firm';
const ANALYST_FOCUS = process.env.ANALYST_FOCUS || 'Equities';

// ─── Discord Client Setup ─────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ─── On Ready ────────────────────────────────────────────────────────────────

client.once('ready', () => {
  console.log(`\n✅ ${ANALYST_NAME} Bot is online as: ${client.user.tag}`);

  const health = getStoreHealth();
  if (health.ready) {
    console.log(`📚 Research store: ${health.totalChunks} chunks from ${health.sources.length} source(s)`);
    console.log(`   Sources: ${health.sources.join(', ')}`);
  } else {
    console.warn(`⚠️  No research documents loaded! Run: npm run ingest ./docs`);
  }

  client.user.setActivity(`/ask me anything | ${ANALYST_FIRM}`, {
    type: ActivityType.Watching,
  });
});

// ─── Slash Command Handler ────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ── /ask ──────────────────────────────────────────────────────────────────
  if (commandName === 'ask') {
    const question = interaction.options.getString('question');

    // Defer reply — AI can take a few seconds
    await interaction.deferReply();

    try {
      const { answer, footer, sources } = await getAnalystResponse(question);

      const embed = new EmbedBuilder()
        .setColor(0x1a56db) // Professional blue
        .setAuthor({
          name: `${ANALYST_NAME} · ${ANALYST_TITLE}`,
          iconURL: interaction.guild?.iconURL() || undefined,
        })
        .setTitle(`💬 ${truncate(question, 200)}`)
        .setDescription(answer)
        .setFooter({
          text: sources.length > 0
            ? `📁 Sources: ${sources.join(' · ')}`
            : `⚠️ No specific research matched — general response`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error generating response:', err);
      await interaction.editReply({
        content: '❌ Something went wrong generating a response. Please try again.',
      });
    }
  }

  // ── /research ─────────────────────────────────────────────────────────────
  if (commandName === 'research') {
    const health = getStoreHealth();

    const embed = new EmbedBuilder()
      .setColor(0x0f9d58) // Green
      .setTitle(`📚 ${ANALYST_NAME}'s Research Library`)
      .setDescription(
        health.ready
          ? `I have **${health.totalChunks} research chunks** loaded across **${health.sources.length} document(s)**:`
          : '⚠️ No research documents have been loaded yet.'
      );

    if (health.ready) {
      embed.addFields({
        name: 'Loaded Documents',
        value: health.sources.map(s => `• \`${s}\``).join('\n') || 'None',
        inline: false,
      });
    }

    embed.setFooter({ text: `Use /ask to query this research` }).setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── /analyst ──────────────────────────────────────────────────────────────
  if (commandName === 'analyst') {
    const health = getStoreHealth();

    const embed = new EmbedBuilder()
      .setColor(0x1a56db)
      .setTitle(`👤 About ${ANALYST_NAME}`)
      .addFields(
        { name: 'Title', value: ANALYST_TITLE, inline: true },
        { name: 'Firm', value: ANALYST_FIRM, inline: true },
        { name: 'Focus', value: ANALYST_FOCUS, inline: true },
        {
          name: 'Research Coverage',
          value: health.ready
            ? `${health.totalChunks} chunks across ${health.sources.length} report(s)`
            : 'No documents loaded',
          inline: false,
        },
        {
          name: 'How to Use',
          value: '`/ask <question>` — Ask about any covered topic\n`/research` — View loaded documents',
          inline: false,
        }
      )
      .setFooter({ text: `Powered by Claude AI · ${ANALYST_FIRM}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

// ─── Error Handling ───────────────────────────────────────────────────────────

client.on('error', (err) => console.error('Discord client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

// ─── Launch ───────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);
