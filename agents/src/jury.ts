// jury.ts — resolution for SUBJECTIVE markets: questions no API can answer and
// no oracle can sign. a panel of independent LLM adjudicators each researches
// the claim, cites its basis, and votes. a supermajority resolves the market
// on-chain; genuine disagreement returns UNRESOLVED and opens a dispute window.
//
// this is the whole point of SOOTH: attestation oracles need a source to sign.
// when there is no source, a market prices the belief and a jury settles it —
// transparently, with every verdict and citation logged on-chain-adjacent.
import { logActivity } from './base.ts';

const VENICE_URL = 'https://api.venice.ai/api/v1/chat/completions';
const MODEL = process.env.VENICE_MODEL ?? 'z-ai-glm-5-turbo';

// distinct evidentiary stances reduce correlated error — each juror is told to
// weigh a different failure mode, so they don't all hallucinate the same way.
const JURORS = [
  {
    id: 'juror-primary',
    stance:
      'You are the PRIMARY adjudicator. Weigh the most direct, load-bearing evidence. Resolve only on facts you are confident are established.',
  },
  {
    id: 'juror-skeptic',
    stance:
      'You are the SKEPTIC adjudicator. Assume claims are unproven until clearly demonstrated. If the evidence is thin or speculative, vote unresolved.',
  },
  {
    id: 'juror-literalist',
    stance:
      'You are the LITERALIST adjudicator. Resolve strictly on the exact wording and timeframe of the question. A near-miss on the criteria is a NO, not a YES.',
  },
  {
    id: 'juror-contrarian',
    stance:
      'You are the CONTRARIAN adjudicator. Actively look for the strongest case AGAINST the consensus reading before you vote, then decide honestly.',
  },
  {
    id: 'juror-synthesizer',
    stance:
      'You are the SYNTHESIZER adjudicator. Weigh the balance of all considerations and render the most defensible verdict a reasonable panel would reach.',
  },
];

export interface Verdict {
  juror: string;
  vote: 'yes' | 'no' | 'unresolved';
  confidence: number;
  basis: string; // one-sentence cited reasoning
}

export interface JuryResult {
  decided: boolean;
  outcome?: boolean; // only when decided
  tally: { yes: number; no: number; unresolved: number };
  verdicts: Verdict[];
  rationale: string;
}

/** optional light evidence — free headlines to ground the panel */
async function gatherEvidence(question: string): Promise<string[]> {
  try {
    const r = await fetch(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest',
    );
    if (!r.ok) return [];
    const data = (await r.json()) as { Data: { title: string }[] };
    const q = question.toLowerCase();
    const kws = q.split(/\W+/).filter((w) => w.length > 4);
    return data.Data.slice(0, 12)
      .map((n) => n.title)
      .filter((t) => kws.some((k) => t.toLowerCase().includes(k)))
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function askJuror(
  stance: string,
  question: string,
  criteria: string,
  evidence: string[],
): Promise<Omit<Verdict, 'juror'>> {
  const res = await fetch(VENICE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VENICE_API_KEY ?? ''}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `${stance}\nYou resolve prediction markets on questions that have no authoritative data source. You must reach a verdict from your own knowledge and reasoning. Be honest: if you genuinely cannot establish the answer, vote "unresolved" rather than guessing.`,
        },
        {
          role: 'user',
          content: `MARKET QUESTION: "${question}"
RESOLUTION CRITERIA: ${criteria || 'Resolve YES if the claim in the question is true as of now, otherwise NO.'}
${evidence.length ? `RECENT HEADLINES (may or may not be relevant):\n- ${evidence.join('\n- ')}` : 'No external evidence was retrievable; reason from your own knowledge.'}

Render your verdict. Respond with ONLY a JSON object, no markdown fences:
{"vote": "yes"|"no"|"unresolved", "confidence": <0..1>, "basis": "<one sentence citing what your verdict rests on>"}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`venice ${res.status}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = body.choices[0].message.content
    .trim()
    .replace(/^```json?\s*|\s*```$/g, '')
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '');
  const parsed = JSON.parse(text) as Omit<Verdict, 'juror'>;
  if (!['yes', 'no', 'unresolved'].includes(parsed.vote)) parsed.vote = 'unresolved';
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  parsed.basis = String(parsed.basis ?? '').slice(0, 240);
  return parsed;
}

/**
 * Convene the jury on a subjective market.
 * Requires >=3 votes and a >=2/3 supermajority of decided (non-unresolved)
 * votes to settle; otherwise returns decided:false (dispute window).
 */
export async function adjudicate(
  marketHash: string,
  question: string,
  criteria: string,
): Promise<JuryResult> {
  logActivity({ agent: 'jury', action: 'convened', market: marketHash });
  const evidence = await gatherEvidence(question);

  const verdicts: Verdict[] = [];
  for (const j of JURORS) {
    try {
      const v = await askJuror(j.stance, question, criteria, evidence);
      const verdict: Verdict = { juror: j.id, ...v };
      verdicts.push(verdict);
      logActivity({
        agent: 'jury',
        action: 'verdict',
        market: marketHash,
        juror: j.id,
        vote: v.vote,
        confidence: v.confidence,
        thesis: v.basis,
      });
    } catch (e) {
      logActivity({ agent: 'jury', action: 'error', market: marketHash, error: String(e) });
    }
  }

  const tally = {
    yes: verdicts.filter((v) => v.vote === 'yes').length,
    no: verdicts.filter((v) => v.vote === 'no').length,
    unresolved: verdicts.filter((v) => v.vote === 'unresolved').length,
  };
  const decidedVotes = tally.yes + tally.no;
  const majority = Math.max(tally.yes, tally.no);

  // need at least 3 opinions and a two-thirds supermajority among them
  if (verdicts.length >= 3 && decidedVotes >= 3 && majority >= Math.ceil(decidedVotes * (2 / 3))) {
    const outcome = tally.yes > tally.no;
    const rationale = `panel ${tally.yes}-${tally.no}${
      tally.unresolved ? ` (${tally.unresolved} abstain)` : ''
    } → ${outcome ? 'YES' : 'NO'}`;
    return { decided: true, outcome, tally, verdicts, rationale };
  }

  return {
    decided: false,
    tally,
    verdicts,
    rationale: `no supermajority (${tally.yes}-${tally.no}, ${tally.unresolved} abstain) — dispute window`,
  };
}
