// src/ingest.js
// Run this script to ingest analyst documents:
//   node src/ingest.js ./docs/report.pdf
//   node src/ingest.js ./docs/  (ingests entire folder)

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { chunkText, ingestChunks, getStoreStats, clearStore } from './store.js';

// ─── PDF Parsing ──────────────────────────────────────────────────────────────

async function parsePdf(filePath) {
  // Dynamic import to handle CommonJS module
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ─── File Routing ─────────────────────────────────────────────────────────────

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      console.log(`  📄 Parsing PDF: ${path.basename(filePath)}`);
      return await parsePdf(filePath);

    case '.txt':
    case '.md':
    case '.markdown':
      console.log(`  📝 Reading text: ${path.basename(filePath)}`);
      return fs.readFileSync(filePath, 'utf-8');

    default:
      console.warn(`  ⚠️  Unsupported file type: ${ext} — skipping`);
      return null;
  }
}

// ─── Ingest Single File ───────────────────────────────────────────────────────

async function ingestFile(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`  ❌ File not found: ${absPath}`);
    return 0;
  }

  const text = await extractText(absPath);
  if (!text || text.trim().length === 0) {
    console.warn(`  ⚠️  No text extracted from ${path.basename(absPath)}`);
    return 0;
  }

  const sourceName = path.basename(absPath);
  const chunks = chunkText(text, sourceName);
  const count = ingestChunks(chunks);

  console.log(`  ✅ Ingested ${count} chunks from "${sourceName}"`);
  return count;
}

// ─── Ingest Folder ────────────────────────────────────────────────────────────

async function ingestFolder(folderPath) {
  const absPath = path.resolve(folderPath);
  const files = fs.readdirSync(absPath).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.pdf', '.txt', '.md', '.markdown'].includes(ext);
  });

  if (files.length === 0) {
    console.warn(`No supported files found in ${absPath}`);
    return;
  }

  console.log(`\nFound ${files.length} files in ${absPath}:\n`);
  for (const file of files) {
    await ingestFile(path.join(absPath, file));
  }
}

// ─── CLI Entry ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--clear')) {
    clearStore();
    console.log('🗑️  Store cleared.');
    return;
  }

  if (args.includes('--stats')) {
    const stats = getStoreStats();
    console.log('\n📊 Store Stats:');
    console.log(`   Total chunks: ${stats.totalChunks}`);
    console.log(`   Sources (${stats.sources.length}):`);
    for (const src of stats.sources) {
      const m = stats.metadata[src];
      console.log(`     • ${src} — ${m.chunkCount} chunks (ingested ${new Date(m.ingestedAt).toLocaleDateString()})`);
    }
    return;
  }

  if (args.length === 0) {
    console.log(`
Analyst Bot — Document Ingestion
─────────────────────────────────
Usage:
  node src/ingest.js <file-or-folder>   Ingest file(s)
  node src/ingest.js --stats            Show what's been ingested
  node src/ingest.js --clear            Wipe the document store

Supported formats: .pdf, .txt, .md
    `);
    return;
  }

  console.log('\n🔄 Starting ingestion...\n');
  let total = 0;

  for (const arg of args) {
    const absPath = path.resolve(arg);
    const stat = fs.existsSync(absPath) ? fs.statSync(absPath) : null;

    if (!stat) {
      console.error(`❌ Not found: ${arg}`);
    } else if (stat.isDirectory()) {
      await ingestFolder(absPath);
    } else {
      total += await ingestFile(absPath);
    }
  }

  const stats = getStoreStats();
  console.log(`\n✨ Done! Store now has ${stats.totalChunks} total chunks across ${stats.sources.length} source(s).`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
