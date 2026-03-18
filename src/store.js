// src/store.js
// Simple document store with TF-IDF-style keyword retrieval
// Stores chunks as JSON on disk — replace with Pinecone/Chroma for scale

import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'chunks.json');
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '600');

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadStore() {
  if (!fs.existsSync(DATA_PATH)) return { chunks: [], metadata: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    // Gracefully handle empty or malformed store files
    return {
      chunks:   Array.isArray(parsed.chunks)   ? parsed.chunks   : [],
      metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {},
    };
  } catch {
    return { chunks: [], metadata: {} };
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

export function chunkText(text, source) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const slice = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (slice.trim().length < 50) continue; // skip tiny trailing chunks

    chunks.push({
      id: `${source}-${i}`,
      source,
      text: slice,
      tokens: slice.toLowerCase().split(/\W+/).filter(w => w.length > 2),
      addedAt: new Date().toISOString(),
    });
  }
  return chunks;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

export function ingestChunks(newChunks) {
  const store = loadStore();

  // Remove old chunks from the same source before re-adding
  const sources = [...new Set(newChunks.map(c => c.source))];
  store.chunks = store.chunks.filter(c => !sources.includes(c.source));

  store.chunks.push(...newChunks);
  store.metadata[sources[0]] = {
    chunkCount: newChunks.length,
    ingestedAt: new Date().toISOString(),
  };

  saveStore(store);
  return newChunks.length;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

function tokenize(text) {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
}

// Stop words to ignore in scoring
const STOP_WORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was',
  'one','our','out','day','get','has','him','his','how','man','new','now',
  'old','see','two','way','who','boy','did','its','let','put','say','she',
  'too','use','that','this','with','have','from','they','will','been','were',
  'said','each','which','their','time','there','about','would','these','other',
  'into','than','then','some','more','very','what','know','just','your',
]);

function score(chunk, queryTokens) {
  const chunkSet = new Set(chunk.tokens);
  let hits = 0;
  for (const t of queryTokens) {
    if (!STOP_WORDS.has(t) && chunkSet.has(t)) hits++;
  }
  // Boost exact phrase matches
  const lowerText = chunk.text.toLowerCase();
  const queryPhrase = queryTokens.join(' ');
  const phraseBoost = lowerText.includes(queryPhrase) ? 3 : 0;
  return hits + phraseBoost;
}

export function retrieveChunks(query, topK = 8) {
  const store = loadStore();
  if (store.chunks.length === 0) return [];

  const queryTokens = tokenize(query).filter(t => !STOP_WORDS.has(t));

  const scored = store.chunks
    .map(chunk => ({ chunk, score: score(chunk, queryTokens) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(s => s.chunk);
}

export function getStoreStats() {
  const store = loadStore();
  return {
    totalChunks: store.chunks.length,
    sources: Object.keys(store.metadata),
    metadata: store.metadata,
  };
}

export function clearStore() {
  saveStore({ chunks: [], metadata: {} });
}
