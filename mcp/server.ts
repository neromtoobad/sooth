#!/usr/bin/env -S npx tsx
/**
 * SOOTH MCP server — makes the market-priced oracle a native tool.
 *
 * Any MCP client (Claude Desktop, an agent framework, your own loop) can now:
 *   • list the live markets
 *   • read the market's probability for a question — the oracle, as a tool call
 *   • place a bet, trading its own belief on-chain
 *
 * This is the agent economy made literal: an LLM can *ask the market what it
 * thinks* and *put money on its own view* without leaving its tool loop.
 *
 * Config (claude_desktop_config.json):
 *   { "mcpServers": { "sooth": { "command": "npx", "args": ["tsx",
 *     "/abs/path/mcp/server.ts"], "env": { "SOOTH_MCP_KEY": "/abs/keys/guest.pem" } } } }
 */
import { join } from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SoothClient, loadDeployments, toNano, fromNano } from '@sooth/lib/sooth.ts';
import { EXPLORER } from '@sooth/lib/casper.ts';

const KEY = process.env.SOOTH_MCP_KEY ?? join(import.meta.dirname, '..', 'keys', 'guest.pem');

let clientPromise: Promise<SoothClient> | null = null;
function client(): Promise<SoothClient> {
  clientPromise ??= SoothClient.connect(KEY);
  return clientPromise;
}

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

const server = new McpServer({ name: 'sooth', version: '1.0.0' });

server.registerTool(
  'list_markets',
  {
    description:
      'List the live SOOTH prediction markets on Casper — the question, whether it can be answered by any data source (deterministic) or only by the crowd (unsignable), and the market hash. Call get_probability with a hash to read its live price.',
    inputSchema: {},
  },
  async () => {
    const { markets } = loadDeployments();
    const rows = markets.map((m) => {
      const kind =
        (m as { kind?: string }).kind === 'subjective' ? 'UNSIGNABLE' : 'deterministic';
      const closes = m.closeTs > Date.now() ? 'open' : 'closed';
      return `• [${kind}] ${m.question}\n    ${closes} · hash=${m.hash}`;
    });
    return text(
      `SOOTH markets (${markets.length}):\n${rows.join('\n')}\n\n` +
        `call get_probability(marketHash) to read the oracle for any of these.`,
    );
  },
);

server.registerTool(
  'get_probability',
  {
    description:
      "Read the SOOTH oracle: the market-priced probability of YES for a market, aggregated from every agent that has traded it. This is the product — truth priced by incentives, not attested by a signature. Pass a market hash from list_markets.",
    inputSchema: { marketHash: z.string().describe('market package hash from list_markets') },
  },
  async ({ marketHash }) => {
    const c = await client();
    const info = await c.marketInfo(marketHash);
    return text(
      `"${info.question}"\n` +
        `market-implied p(YES) = ${(info.pYes * 100).toFixed(1)}%\n` +
        `resolved: ${info.resolved}${info.resolved ? ` → ${info.outcome ? 'YES' : 'NO'}` : ''}\n` +
        `this probability is the oracle read. in production it costs 1 sUSD via x402.`,
    );
  },
);

server.registerTool(
  'place_bet',
  {
    description:
      'Trade your belief on a SOOTH market, on-chain. If you think the market underprices YES, buy YES; if it overprices YES, buy NO. Costs real sUSD from the configured wallet and moves the probability. Returns the transaction hash.',
    inputSchema: {
      marketHash: z.string().describe('market package hash from list_markets'),
      side: z.enum(['yes', 'no']).describe('the outcome you are betting on'),
      amountSusd: z.number().positive().max(50).describe('stake in sUSD (1–50)'),
    },
  },
  async ({ marketHash, side, amountSusd }) => {
    const c = await client();
    const before = await c.priceYes(marketHash);
    // ensure the market can pull collateral (idempotent)
    try {
      await c.approve(marketHash, toNano(amountSusd * 4));
    } catch {
      /* already approved */
    }
    const tx =
      side === 'yes'
        ? await c.buyYes(marketHash, toNano(amountSusd))
        : await c.buyNo(marketHash, toNano(amountSusd));
    const after = await c.priceYes(marketHash);
    return text(
      `bought ${amountSusd} sUSD of ${side.toUpperCase()}.\n` +
        `p(YES): ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%\n` +
        `tx: ${EXPLORER}/transaction/${tx}`,
    );
  },
);

server.registerTool(
  'my_balance',
  {
    description: 'Check the SOOTH wallet balance (sUSD) this MCP server trades with.',
    inputSchema: {},
  },
  async () => {
    const c = await client();
    const bal = await c.susdBalance();
    return text(`wallet ${c.publicKeyHex.slice(0, 12)}… holds ${fromNano(bal).toFixed(2)} sUSD`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
