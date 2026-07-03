// momo — momentum trader. believes the recent move continues to close.
// fair p = logistic(distance-to-strike + momentum boost); trades when the
// market disagrees with fair by more than the edge threshold.
import { envConfig, logistic, runAgent, spotAgo, type AgentContext, type Decision } from './base.ts';

const EDGE = 0.05; // trade only if |fair - market| > 5pts
const DIST_SENS_2H = 400; // sensitivity calibrated for a 2-hour horizon
const MOMO_BOOST_2H = 120; // momentum weight at the same calibration

function decide(ctx: AgentContext): Decision {
  const { feed, pYes, strike, closeTs } = ctx;
  const dist = (feed.spot - strike) / strike;
  const momentum = (feed.spot - spotAgo(feed, 60)) / feed.spot;
  // volatility grows ~sqrt(time): a 0.5% gap is huge with 2h left, noise with 3 days
  const hoursLeft = Math.max((closeTs - Date.now()) / 3_600_000, 0.25);
  const horizon = Math.sqrt(2 / hoursLeft);
  const fair = logistic(dist * DIST_SENS_2H * horizon + momentum * MOMO_BOOST_2H * horizon);
  const edge = fair - pYes;

  const signal = `spot=${feed.spot.toFixed(0)} dist=${(dist * 100).toFixed(2)}% mom1h=${(momentum * 100).toFixed(2)}% fair=${fair.toFixed(2)} mkt=${pYes.toFixed(2)}`;

  if (edge > EDGE) return { action: 'buy_yes', size: Math.min(edge * 20, 5), signal };
  if (edge < -EDGE) return { action: 'buy_no', size: Math.min(-edge * 20, 5), signal };
  return { action: 'hold', size: 0, signal };
}

runAgent(envConfig('momo'), decide);
