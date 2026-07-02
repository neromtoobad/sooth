// momo — momentum trader. believes the recent move continues to close.
// fair p = logistic(distance-to-strike + momentum boost); trades when the
// market disagrees with fair by more than the edge threshold.
import { envConfig, logistic, runAgent, spotAgo, type AgentContext, type Decision } from './base.ts';

const EDGE = 0.05; // trade only if |fair - market| > 5pts
const DIST_SENS = 400; // sensitivity of p to % distance from strike
const MOMO_BOOST = 120; // extra weight on the last hour's move

function decide(ctx: AgentContext): Decision {
  const { feed, pYes, strike } = ctx;
  const dist = (feed.spot - strike) / strike;
  const momentum = (feed.spot - spotAgo(feed, 60)) / feed.spot;
  const fair = logistic(dist * DIST_SENS + momentum * MOMO_BOOST);
  const edge = fair - pYes;

  const signal = `spot=${feed.spot.toFixed(0)} dist=${(dist * 100).toFixed(2)}% mom1h=${(momentum * 100).toFixed(2)}% fair=${fair.toFixed(2)} mkt=${pYes.toFixed(2)}`;

  if (edge > EDGE) return { action: 'buy_yes', size: Math.min(edge * 20, 5), signal };
  if (edge < -EDGE) return { action: 'buy_no', size: Math.min(-edge * 20, 5), signal };
  return { action: 'hold', size: 0, signal };
}

runAgent(envConfig('momo'), decide);
