// vibes — the LLM trader. pays x402 for the feed, reads headlines, asks claude
// for a direction + one-line thesis (shown on the dashboard), trades if confident.
// hard-capped LLM spend: max 10 calls/hour.
import { envConfig, logActivity, spotAgo, type FeedData } from './base.ts';
import { payingFetch, pemPathFor, settlementRef } from '@sooth/lib/x402-client.ts';
import { SoothClient, toNano } from '@sooth/lib/sooth.ts';

const cfg = envConfig('vibes');
const MIN_CONFIDENCE = 0.6;
const MAX_LLM_CALLS_PER_HOUR = 10;
const llmCalls: number[] = [];

interface VibesDecision {
  direction: 'yes' | 'no' | 'hold';
  confidence: number;
  thesis: string;
}

async function headlines(): Promise<string[]> {
  try {
    const r = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC');
    if (!r.ok) return [];
    const data = (await r.json()) as { Data: { title: string }[] };
    return data.Data.slice(0, 3).map((n) => n.title);
  } catch {
    return [];
  }
}

async function askClaude(feed: FeedData, news: string[], pYes: number): Promise<VibesDecision> {
  const now = Date.now();
  while (llmCalls.length && now - llmCalls[0] > 3_600_000) llmCalls.shift();
  if (llmCalls.length >= MAX_LLM_CALLS_PER_HOUR) {
    return { direction: 'hold', confidence: 0, thesis: 'llm budget spent this hour' };
  }
  llmCalls.push(now);

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic();

  const momentum = ((feed.spot - spotAgo(feed, 60)) / feed.spot) * 100;
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['yes', 'no', 'hold'] },
            confidence: { type: 'number' },
            thesis: { type: 'string' },
          },
          required: ['direction', 'confidence', 'thesis'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: `You are a prediction-market trader. Market: "BTC/USD closes above $${cfg.strike}". Current BTC: $${feed.spot} (1h momentum ${momentum.toFixed(2)}%). Market-implied probability of YES: ${(pYes * 100).toFixed(0)}%. Recent headlines: ${news.join(' | ') || 'none'}. Give your trading decision with a one-sentence thesis.`,
      },
    ],
  });
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('no text block in llm response');
  return JSON.parse(block.text) as VibesDecision;
}

async function main() {
  if (!cfg.marketHash) throw new Error('MARKET_HASH env required');
  const client = await SoothClient.connect(pemPathFor('vibes'));
  const fetchPaid = await payingFetch(pemPathFor('vibes'));

  logActivity({ agent: 'vibes', action: 'start', market: cfg.marketHash });

  for (;;) {
    try {
      const res = await fetchPaid(cfg.feedUrl);
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const feed = (await res.json()) as FeedData;
      const paymentRef = await settlementRef(res);

      const pYes = await client.priceYes(cfg.marketHash);
      const news = await headlines();
      const decision = await askClaude(feed, news, pYes);

      let txHash: string | null = null;
      if (decision.direction !== 'hold' && decision.confidence > MIN_CONFIDENCE) {
        const size = Math.min(decision.confidence * cfg.maxTradeSusd, cfg.maxTradeSusd);
        txHash =
          decision.direction === 'yes'
            ? await client.buyYes(cfg.marketHash, toNano(size))
            : await client.buyNo(cfg.marketHash, toNano(size));
      }

      logActivity({
        agent: 'vibes',
        action: decision.direction === 'hold' ? 'hold' : `buy_${decision.direction}`,
        confidence: decision.confidence,
        thesis: decision.thesis,
        p_yes: pYes,
        spot: feed.spot,
        txHash,
        x402_payment: paymentRef,
      });
    } catch (e) {
      logActivity({ agent: 'vibes', action: 'error', error: String(e) });
    }
    await new Promise((r) => setTimeout(r, Math.max(cfg.intervalMs, 60_000)));
  }
}

main();
