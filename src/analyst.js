// src/analyst.js
// Core AI engine — retrieves relevant chunks and generates analyst-style responses

import Anthropic from '@anthropic-ai/sdk';
import { retrieveChunks, getStoreStats } from './store.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYST_NAME  = process.env.ANALYST_NAME  || 'The Analyst';
const ANALYST_TITLE = process.env.ANALYST_TITLE || 'Senior Analyst';
const ANALYST_FIRM  = process.env.ANALYST_FIRM  || 'Research Firm';
const ANALYST_FOCUS = process.env.ANALYST_FOCUS || 'Equities';
const MAX_CHUNKS    = parseInt(process.env.MAX_CONTEXT_CHUNKS || '8');

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(contextChunks) {
  const hasContext = contextChunks.length > 0;

  const contextSection = hasContext
    ? `\n\n## Your Research Materials\nThe following excerpts are from your own reports, notes, and analysis. Use them as the primary basis for your response:\n\n${
        contextChunks
          .map((c, i) => `[Source: ${c.source}]\n${c.text}`)
          .join('\n\n---\n\n')
      }`
    : `\n\n## Note\nNo directly relevant research materials were found for this query. Be transparent that you don't have specific research on this topic, and offer general guidance if appropriate.`;

  return `You are ${ANALYST_NAME}, a ${ANALYST_TITLE} at ${ANALYST_FIRM} specializing in ${ANALYST_FOCUS}.

## Your Persona
- Respond in first person, as if you ARE this analyst
- Be direct, confident, and data-driven — analysts don't hedge excessively
- Reference specific data points, companies, or figures from your research when available
- Use analyst language: "my thesis is...", "I'm watching...", "based on my analysis...", "the key risk here is..."
- Keep responses focused and actionable — Discord users want signal, not noise
- If asked about something outside your research, say so clearly rather than speculating
- Format responses for Discord: use **bold** for key points, avoid walls of text
- Keep responses under ~400 words unless a detailed breakdown is specifically requested
${contextSection}

## Important
You are responding in a Discord channel. Be conversational but sharp. Lead with the most important insight.`;
}

// ─── Main Response Function ───────────────────────────────────────────────────

export async function getAnalystResponse(question, followUpHistory = []) {
  // 1. Retrieve relevant document chunks
  const chunks = retrieveChunks(question, MAX_CHUNKS);

  // 2. Build messages array (supports follow-up conversations)
  const messages = [
    ...followUpHistory,
    { role: 'user', content: question },
  ];

  // 3. Call Claude
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: buildSystemPrompt(chunks),
    messages,
  });

  const answer = response.content[0].text;

  // 4. Append source attribution footer if chunks were used
  const sources = [...new Set(chunks.map(c => c.source))];
  const footer = sources.length > 0
    ? `\n\n*📁 Based on: ${sources.join(', ')}*`
    : `\n\n*⚠️ No matching research found — responding from general knowledge*`;

  return { answer, footer, sources };
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export function getStoreHealth() {
  const stats = getStoreStats();
  return {
    ready: stats.totalChunks > 0,
    totalChunks: stats.totalChunks,
    sources: stats.sources,
  };
}
