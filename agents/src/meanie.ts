// meanie — mean-reversion trader. fades sharp probability moves: when p_yes
// runs away from its recent average, meanie bets it comes back.
import { envConfig, runAgent, type AgentContext, type Decision } from './base.ts';

const LOOKBACK = 10; // observations (~5 min at 30s cadence)
const DIVERGENCE = 0.06; // fade moves bigger than 6pts off the mean

function decide(ctx: AgentContext): Decision {
  const { pYes, history } = ctx;
  if (history.length < 3) {
    return { action: 'hold', size: 0, signal: 'warming up' };
  }
  const window = history.slice(-LOOKBACK, -1);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const div = pYes - mean;

  const signal = `p=${pYes.toFixed(2)} mean${window.length}=${mean.toFixed(2)} div=${(div * 100).toFixed(1)}pts`;

  // p spiked above its mean → fade with NO; crashed below → fade with YES
  if (div > DIVERGENCE) return { action: 'buy_no', size: Math.min(div * 25, 5), signal };
  if (div < -DIVERGENCE) return { action: 'buy_yes', size: Math.min(-div * 25, 5), signal };
  return { action: 'hold', size: 0, signal };
}

runAgent(envConfig('meanie'), decide);
