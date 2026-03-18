# 🤖 Analyst Discord Bot

A Discord bot that reads your analyst's research reports, notes, and PDFs — then responds to questions **in the analyst's voice** using RAG + Claude AI.

---

## How It Works

```
User types /ask "What's your view on NVDA?"
        ↓
Bot searches analyst's research chunks for relevant context
        ↓
Claude generates a response in the analyst's persona
        ↓
Discord embed with answer + source attribution
```

---

## Setup Guide

### 1. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it the analyst's name
3. Go to **Bot** tab → click **Add Bot**
4. Copy the **Bot Token** (you'll need this for `.env`)
5. Under **OAuth2 → General**, copy the **Client ID**
6. Under **Bot** tab, enable:
   - ✅ `applications.commands` (slash commands)
   - ✅ `bot`
7. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot` + `applications.commands`
   - Bot Permissions: `Send Messages` + `Use Slash Commands` + `Embed Links`
   - Copy the generated URL and use it to invite the bot to your server

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
ANTHROPIC_API_KEY=your_anthropic_key

# Customize the analyst's identity:
ANALYST_NAME=Alex Chen
ANALYST_TITLE=Senior Equity Analyst
ANALYST_FIRM=Acme Capital
ANALYST_FOCUS=Technology & Growth Stocks
```

### 4. Ingest Research Documents

Drop your PDFs, `.txt`, or `.md` files into the `docs/` folder, then run:

```bash
# Ingest everything in the docs/ folder
npm run ingest ./docs

# Or ingest a specific file
npm run ingest ./docs/q3-report.pdf

# Check what's been ingested
npm run ingest -- --stats
```

### 5. Register Slash Commands

```bash
npm run register
```

> ⚠️ Only needs to be run once. Global commands can take up to 1 hour to propagate.

### 6. Start the Bot

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

---

## Discord Commands

| Command | Description |
|---|---|
| `/ask <question>` | Ask the analyst anything — queries research docs |
| `/research` | See what documents are loaded (private reply) |
| `/analyst` | View the analyst's profile and coverage |

---

## Deploying to Railway (Recommended)

Railway is the easiest way to host the bot 24/7 for ~$5/month.

1. Push your project to GitHub (make sure `data/chunks.json` is committed after ingesting!)
2. Go to https://railway.app → **New Project → Deploy from GitHub**
3. Select your repo
4. Go to **Variables** tab and add all your `.env` values
5. Railway auto-detects the `Dockerfile` and deploys

**Important:** The `data/chunks.json` file (your ingested documents) needs to either be:
- **Committed to git** (simplest — just remove `data/chunks.json` from `.gitignore`)
- **Re-ingested on the server** using a Railway one-off command

### Other Hosting Options

**Render** (free tier available):
- Create a new Web Service → connect GitHub repo
- Set Build Command: `npm install`
- Set Start Command: `npm start`
- Add environment variables in the dashboard

**VPS / DigitalOcean:**
```bash
git clone your-repo
cd analyst-bot
npm install
cp .env.example .env && nano .env
npm run ingest ./docs
npm run register
npm start

# Keep alive with PM2:
npm install -g pm2
pm2 start src/index.js --name analyst-bot
pm2 save && pm2 startup
```

---

## Adding New Research

When the analyst publishes new reports:

```bash
# Add new files to docs/ folder, then:
npm run ingest ./docs/new-report.pdf

# The bot immediately uses the new content — no restart needed
```

---

## Project Structure

```
analyst-bot/
├── src/
│   ├── index.js          # Discord bot & command handlers
│   ├── analyst.js        # Claude AI response engine
│   ├── store.js          # Document chunking & retrieval
│   ├── ingest.js         # CLI ingestion script
│   └── register-commands.js  # Slash command registration
├── docs/                 # Drop your PDFs & notes here
├── data/
│   └── chunks.json       # Ingested document store (auto-generated)
├── .env.example
├── Dockerfile
├── railway.toml
└── package.json
```

---

## Customization Tips

- **Analyst persona:** Edit `ANALYST_NAME`, `ANALYST_TITLE` etc. in `.env`
- **Response length:** Lower `MAX_CONTEXT_CHUNKS` for shorter answers
- **Chunk granularity:** Decrease `CHUNK_SIZE` (words) for more precise retrieval
- **Scale up:** Swap `data/chunks.json` for [Pinecone](https://pinecone.io) or [ChromaDB](https://docs.trychroma.com) for larger document sets
