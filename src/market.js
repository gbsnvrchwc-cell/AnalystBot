// src/market.js
// Market data layer using yahoo-finance2 (no API key required)
// Modular — swap this file's internals for any data provider without touching the rest of the bot

import yahooFinance from 'yahoo-finance2';

// Suppress yahoo-finance2 validation warnings


// ─── Core Quote ───────────────────────────────────────────────────────────────

export async function getQuote(ticker) {
  const data = await yahooFinance.quote(ticker.toUpperCase());
  return {
    ticker:        data.symbol,
    price:         data.regularMarketPrice,
    prevClose:     data.regularMarketPreviousClose,
    change:        data.regularMarketChange,
    changePct:     data.regularMarketChangePercent,
    volume:        data.regularMarketVolume,
    avgVolume:     data.averageDailyVolume10Day,
    marketCap:     data.marketCap,
    fiftyTwoHigh:  data.fiftyTwoWeekHigh,
    fiftyTwoLow:   data.fiftyTwoWeekLow,
    name:          data.longName || data.shortName || ticker,
    exchange:      data.fullExchangeName,
  };
}

// ─── Historical + Technicals ──────────────────────────────────────────────────

export async function getTechnicals(ticker) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 60); // 60 days for ATR + RSI

  const history = await yahooFinance.historical(ticker.toUpperCase(), {
    period1: start.toISOString().split('T')[0],
    period2: end.toISOString().split('T')[0],
    interval: '1d',
  });

  if (!history || history.length < 15) {
    throw new Error(`Not enough historical data for ${ticker}`);
  }

  const closes = history.map(d => d.close);
  const highs   = history.map(d => d.high);
  const lows    = history.map(d => d.low);

  return {
    rsi14:    calcRSI(closes, 14),
    atr14:    calcATR(highs, lows, closes, 14),
    sma20:    calcSMA(closes, 20),
    sma50:    calcSMA(closes, 50),
    price:    closes[closes.length - 1],
    history,
  };
}

// ─── Options Chain ────────────────────────────────────────────────────────────

export async function getOptionsChain(ticker) {
  const result = await yahooFinance.options(ticker.toUpperCase());

  if (!result || !result.options || result.options.length === 0) {
    throw new Error(`No options data available for ${ticker}`);
  }

  const chain = result.options[0]; // nearest expiry
  const expiryDate = result.expirationDates?.[0];

  // Score calls against swing trade criteria
  const scoredCalls = (chain.calls || [])
    .map(c => scoreOption(c, result.quote?.regularMarketPrice, 'call'))
    .filter(c => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const scoredPuts = (chain.puts || [])
    .map(p => scoreOption(p, result.quote?.regularMarketPrice, 'put'))
    .filter(p => p.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    expiryDate,
    allExpiries: result.expirationDates || [],
    topCalls: scoredCalls,
    topPuts: scoredPuts,
    underlyingPrice: result.quote?.regularMarketPrice,
  };
}

// ─── Earnings Calendar ────────────────────────────────────────────────────────

export async function getEarningsCalendar() {
  // Fetch upcoming earnings for a watchlist of liquid, high-volume names
  const WATCHLIST = [
    'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AMD','NFLX','CRM',
    'PLTR','SNOW','COIN','MSTR','SMCI','ARM','AVGO','ORCL','NOW','UBER',
    'SHOP','SQ','HOOD','RBLX','U','DKNG','RIVN','LCID','SOFI','PYPL',
  ];

  const results = [];

  for (const ticker of WATCHLIST) {
    try {
      const quote = await yahooFinance.quote(ticker, {
        fields: ['earningsTimestamp', 'regularMarketPrice', 'symbol', 'shortName',
                 'regularMarketChangePercent', 'averageDailyVolume10Day'],
      });

      if (quote.earningsTimestamp) {
        const earningsDate = new Date(quote.earningsTimestamp * 1000);
        const daysUntil = Math.ceil((earningsDate - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysUntil >= 0 && daysUntil <= 21) {
          results.push({
            ticker:    quote.symbol,
            name:      quote.shortName || quote.symbol,
            price:     quote.regularMarketPrice,
            changePct: quote.regularMarketChangePercent,
            volume:    quote.averageDailyVolume10Day,
            earningsDate,
            daysUntil,
          });
        }
      }
    } catch {
      // skip tickers that fail quietly
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ─── Option Scorer ────────────────────────────────────────────────────────────

function scoreOption(opt, stockPrice, type) {
  let score = 0;
  const reasons = [];
  const flags = [];

  const delta = opt.delta ?? null;
  const iv    = opt.impliedVolatility ?? null;
  const oi    = opt.openInterest ?? 0;
  const vol   = opt.volume ?? 0;
  const bid   = opt.bid ?? 0;
  const ask   = opt.ask ?? 0;
  const spread = ask > 0 ? (ask - bid) / ask : 1;

  // Delta check (0.50–0.80)
  if (delta !== null) {
    const absDelta = Math.abs(delta);
    if (absDelta >= 0.50 && absDelta <= 0.80) {
      score += 2; reasons.push(`✅ Delta ${absDelta.toFixed(2)} in sweet spot (0.50–0.80)`);
    } else if (absDelta < 0.50) {
      flags.push(`⚠️ Delta ${absDelta.toFixed(2)} low — high time decay`);
    } else {
      flags.push(`⚠️ Delta ${absDelta.toFixed(2)} high — acts like stock`);
    }
  }

  // IV check
  if (iv !== null) {
    const ivPct = iv * 100;
    if (ivPct < 50) {
      score += 2; reasons.push(`✅ IV ${ivPct.toFixed(0)}% — affordable premium`);
    } else if (ivPct < 75) {
      score += 1; flags.push(`⚠️ IV ${ivPct.toFixed(0)}% — elevated, be cautious`);
    } else {
      flags.push(`🚫 IV ${ivPct.toFixed(0)}% — too expensive, premium crush risk`);
    }
  }

  // OI check
  if (oi >= 4000) {
    score += 2; reasons.push(`✅ OI ${oi.toLocaleString()} — highly liquid`);
  } else if (oi >= 500) {
    score += 1; reasons.push(`✅ OI ${oi.toLocaleString()} — acceptable liquidity`);
  } else {
    flags.push(`🚫 OI ${oi.toLocaleString()} — too low, wide spreads likely`);
  }

  // Volume check (20% of OI rule)
  if (oi > 0 && vol >= oi * 0.20) {
    score += 1; reasons.push(`✅ Volume ${vol.toLocaleString()} is ${((vol/oi)*100).toFixed(0)}% of OI`);
  } else if (vol >= 500) {
    score += 1; reasons.push(`✅ Volume ${vol.toLocaleString()} — active`);
  }

  // Spread check
  if (spread < 0.05) {
    score += 1; reasons.push(`✅ Tight spread ${(spread*100).toFixed(1)}%`);
  } else if (spread > 0.15) {
    flags.push(`⚠️ Wide spread ${(spread*100).toFixed(1)}% — slippage risk`);
  }

  return {
    strike:      opt.strike,
    expiry:      opt.expiration,
    bid, ask,
    delta,
    iv:          iv ? (iv * 100).toFixed(1) + '%' : 'N/A',
    openInterest: oi,
    volume:      vol,
    score,
    reasons,
    flags,
    lastPrice:   opt.lastPrice,
  };
}

// ─── Technical Indicator Math ──────────────────────────────────────────────────

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[closes.length - period - 1 + i] - closes[closes.length - period - 2 + i];
    if (diff >= 0) gains += diff; else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calcATR(highs, lows, closes, period = 14) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return parseFloat((recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(2));
}

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
}

// ─── Momentum Scan ────────────────────────────────────────────────────────────
// Finds stocks with RSI momentum + volume surge from watchlist

export async function getMomentumStocks() {
  const WATCHLIST = [
    'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AMD','NFLX','CRM',
    'PLTR','SNOW','COIN','MSTR','SMCI','ARM','AVGO','ORCL','NOW','UBER',
    'SHOP','SQ','HOOD','RBLX','U','DKNG','RIVN','SOFI','PYPL','MU',
    'PANW','CRWD','ZS','NET','DDOG','GTLB','PATH','AI','BBAI','SOUN',
  ];

  const results = [];

  for (const ticker of WATCHLIST) {
    try {
      const quote = await yahooFinance.quote(ticker, {
        fields: [
          'regularMarketPrice','regularMarketChangePercent','regularMarketVolume',
          'averageDailyVolume10Day','symbol','shortName','fiftyTwoWeekHigh','fiftyTwoWeekLow',
        ],
      });

      const volRatio = quote.averageDailyVolume10Day > 0
        ? quote.regularMarketVolume / quote.averageDailyVolume10Day
        : 0;

      const changePct = quote.regularMarketChangePercent || 0;

      // Momentum score: big move + volume surge
      let momentumScore = 0;
      if (Math.abs(changePct) >= 3)  momentumScore += 2;
      if (Math.abs(changePct) >= 5)  momentumScore += 1;
      if (volRatio >= 1.5)           momentumScore += 2;
      if (volRatio >= 2.5)           momentumScore += 1;
      if (changePct > 0)             momentumScore += 1; // bullish bias

      if (momentumScore >= 3) {
        results.push({
          ticker:      quote.symbol,
          name:        quote.shortName || quote.symbol,
          price:       quote.regularMarketPrice,
          changePct,
          volume:      quote.regularMarketVolume,
          avgVolume:   quote.averageDailyVolume10Day,
          volRatio:    parseFloat(volRatio.toFixed(2)),
          momentumScore,
          direction:   changePct >= 0 ? 'bullish' : 'bearish',
          fiftyTwoHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoLow:  quote.fiftyTwoWeekLow,
        });
      }
    } catch {
      // skip silently
    }
  }

  return results.sort((a, b) => b.momentumScore - a.momentumScore);
}

// ─── Macro Context ────────────────────────────────────────────────────────────
// Fetches key macro indicators: SPX, QQQ, VIX, DXY, TLT, sector ETFs

export async function getMacroSnapshot() {
  const MACRO_TICKERS = {
    'SPX':  '^GSPC',
    'QQQ':  'QQQ',
    'VIX':  '^VIX',
    'DXY':  'DX-Y.NYB',
    'TLT':  'TLT',     // Bonds
    'XLK':  'XLK',     // Tech sector
    'XLF':  'XLF',     // Financials
    'XLE':  'XLE',     // Energy
    'ARKK': 'ARKK',    // High-beta growth proxy
    'IWM':  'IWM',     // Small caps
  };

  const snapshot = {};

  for (const [label, ticker] of Object.entries(MACRO_TICKERS)) {
    try {
      const q = await yahooFinance.quote(ticker, {
        fields: ['regularMarketPrice','regularMarketChangePercent','regularMarketVolume'],
      });
      snapshot[label] = {
        ticker,
        price:     q.regularMarketPrice,
        changePct: q.regularMarketChangePercent,
      };
    } catch {
      snapshot[label] = { ticker, price: null, changePct: null };
    }
  }

  return snapshot;
}
