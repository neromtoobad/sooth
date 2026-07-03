// llm.ts — LLM trader personas powered by Venice's OpenAI-compatible API.
// each persona pays x402 for the feed, reads the market, argues its thesis in
// one sentence (shown on the dashboard), and trades only when confident.
// usage: AGENT_NAME=bull MARKET_HASH=… STRIKE=… pnpm tsx src/llm.ts
import { envConfig, installCrashGuards, logActivity, spotAgo, type FeedData } from './base.ts';
import { payingFetch, pemPathFor, settlementRef } from '@sooth/lib/x402-client.ts';
import { SoothClient, loadDeployments, toNano } from '@sooth/lib/sooth.ts';

const PERSONAS: Record<string, string> = {
  vibes:
    'You are VIBES, a narrative-driven crypto trader. You weigh headlines and momentum vibes over models. You are decisive but honest when the picture is mixed.',
  bull: 'You are BULL, a congenital crypto optimist. You believe dips are for buying and every strike gets broken upward. You need a genuinely ugly tape to turn bearish.',
  bear: 'You are BEAR, a professional skeptic and risk manager. You believe strikes above spot rarely get hit, rallies fade, and the market chronically overpays for hope.',
};

const NAME = process.env.AGENT_NAME ?? 'vibes';
const PERSONA = PERSONAS[NAME] ?? PERSONAS.vibes;
const cfg = envConfig(NAME);
const MIN_CONFIDENCE = 0.55;
const MAX_LLM_CALLS_PER_HOUR = 15;
const llmCalls: number[] = [];

interface LlmDecision {
  direction: 'yes' | 'no' | 'hold';
  confidence: number;
  thesis: string;
}

async function headlines(): Promise<string[]> {
  try {
    const r = await fetch(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC',
    );
    if (!r.ok) return [];
    const data = (await r.json()) as { Data: { title: string }[] };
    return data.Data.slice(0, 3).map((n) => n.title);
  } catch {
    return [];
  }
}

async function askLlm(
  feed: FeedData,
  news: string[],
  pYes: number,
  question: string,
  hoursLeft: number,
): Promise<LlmDecision> {
  const now = Date.now();
  while (llmCalls.length && now - llmCalls[0] > 3_600_000) llmCalls.shift();
  if (llmCalls.length >= MAX_LLM_CALLS_PER_HOUR) {
    return { direction: 'hold', confidence: 0, thesis: 'llm budget spent this hour' };
  }
  llmCalls.push(now);

  const momentum = ((feed.spot - spotAgo(feed, 60)) / feed.spot) * 100;
  const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VENICE_API_KEY ?? ''}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.VENICE_MODEL ?? 'z-ai-glm-5-turbo',
      max_tokens: 1200, // reasoning models spend most of this thinking
      temperature: 0.7,
      messages: [
        { role: 'system', content: PERSONA },
        {
          role: 'user',
          content: `You trade a binary prediction market on Casper testnet.
Market question: "${question}"
Time to close: ${hoursLeft.toFixed(1)} hours.
Current underlying price: $${feed.spot} (1h momentum ${momentum.toFixed(2)}%).
Market-implied probability of YES right now: ${(pYes * 100).toFixed(0)}%.
Recent headlines: ${news.join(' | ') || 'none'}.

Decide whether YES is underpriced (buy yes), overpriced (buy no), or fairly priced (hold), staying true to your persona.
Respond with ONLY a JSON object, no markdown fences:
{"direction": "yes"|"no"|"hold", "confidence": <0..1>, "thesis": "<one punchy sentence in your voice>"}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`venice api ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = body.choices[0].message.content
    .trim()
    .replace(/^```json?\s*|\s*```$/g, '')
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '');
  const parsed = JSON.parse(text) as LlmDecision;
  if (!['yes', 'no', 'hold'].includes(parsed.direction)) parsed.direction = 'hold';
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  return parsed;
}

async function main() {
  installCrashGuards(NAME);
  if (!cfg.marketHash) throw new Error('MARKET_HASH env required');
  const client = await SoothClient.connect(pemPathFor(NAME));
  const fetchPaid = await payingFetch(pemPathFor(NAME));
  const market = loadDeployments().markets.find((m) => m.hash === cfg.marketHash);
  const question = market?.question ?? 'unknown market';
  const closeTs = market?.closeTs ?? Date.now() + 2 * 3600_000;

  logActivity({ agent: NAME, action: 'start', market: cfg.marketHash });
  try {
    const approveTx = await client.approve(cfg.marketHash, toNano(100_000));
    logActivity({ agent: NAME, action: 'approve', txHash: approveTx });
  } catch (e) {
    logActivity({ agent: NAME, action: 'error', error: `approve failed: ${String(e)}` });
  }

  for (;;) {
    const cycleStart = Date.now();
    try {
      const res = await fetchPaid(cfg.feedUrl);
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const feed = (await res.json()) as FeedData;
      const paymentRef = await settlementRef(res);

      const pYes = await client.priceYes(cfg.marketHash);
      const news = NAME === 'vibes' ? await headlines() : [];
      const hoursLeft = Math.max((closeTs - Date.now()) / 3_600_000, 0);
      const decision = await askLlm(feed, news, pYes, question, hoursLeft);

      let txHash: string | null = null;
      let action = 'hold';
      if (decision.direction !== 'hold' && decision.confidence > MIN_CONFIDENCE) {
        const size = Math.min(decision.confidence * cfg.maxTradeSusd, cfg.maxTradeSusd);
        txHash =
          decision.direction === 'yes'
            ? await client.buyYes(cfg.marketHash, toNano(size))
            : await client.buyNo(cfg.marketHash, toNano(size));
        action = `buy_${decision.direction}`;
      }

      logActivity({
        agent: NAME,
        action,
        market: cfg.marketHash,
        size:
          action === 'hold'
            ? 0
            : Math.min(decision.confidence * cfg.maxTradeSusd, cfg.maxTradeSusd),
        confidence: decision.confidence,
        thesis: decision.thesis,
        p_yes: pYes,
        spot: feed.spot,
        txHash,
        x402_payment: paymentRef,
      });
    } catch (e) {
      logActivity({ agent: NAME, action: 'error', error: String(e) });
    }
    const elapsed = Date.now() - cycleStart;
    await new Promise((r) => setTimeout(r, Math.max(cfg.intervalMs - elapsed, 60_000)));
  }
}

main();
