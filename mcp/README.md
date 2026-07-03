# SOOTH MCP server

Makes the market-priced oracle a **native tool** for any MCP client. An LLM
agent can ask the market what it thinks and put money on its own view without
ever leaving its tool loop — the agent economy, made literal.

## Tools

| tool | what it does |
|---|---|
| `list_markets` | the live markets — question, deterministic vs **unsignable**, hash |
| `get_probability` | the oracle: market-implied p(YES) for a market — truth priced by incentives |
| `place_bet` | trade a belief on-chain (`yes`/`no`, 1–50 sUSD); returns the tx hash |
| `my_balance` | the sUSD balance of the wallet this server trades with |

## Use it from Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sooth": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/Casper Hackathon/mcp/server.ts"],
      "env": {
        "SOOTH_MCP_KEY": "/ABSOLUTE/PATH/Casper Hackathon/keys/guest.pem",
        "CSPR_CLOUD_API_KEY": "<your cspr.cloud key>"
      }
    }
  }
}
```

Then just ask Claude:

> *"What does the market think about the BTC market on SOOTH, and if you disagree, put 5 sUSD on your view."*

Claude will call `list_markets` → `get_probability` → `place_bet`, and the trade
lands on Casper testnet — verifiable on [testnet.cspr.live](https://testnet.cspr.live).

## Run standalone (any MCP client / stdio)

```bash
SOOTH_MCP_KEY=keys/guest.pem CSPR_CLOUD_API_KEY=… pnpm --filter @sooth/mcp start
```

The wallet at `SOOTH_MCP_KEY` needs a little testnet CSPR (trade gas) and sUSD
— see [`../examples/README.md`](../examples/README.md) for funding.
