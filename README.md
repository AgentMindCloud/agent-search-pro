# Agent Search Pro — x402 Pay-Per-Call API + MCP Server

Live endpoint: **https://aggregator-beta.vercel.app**

Agent-native web search and research synthesis, paid per call in **USDC on Base** via [x402](https://x402.org). No buyer API keys, accounts, or subscriptions. Includes standard HTTP routes for x402 discovery plus a streamable HTTP MCP facade.

> Experimental service: payment and search paths are working and dogfooded with a real 0.02 USDC Base transaction. Availability, pricing, and upstream providers may change during validation.

## Tiers
| Tool | Price | What you get |
|------|-------|--------------|
| `web_search_sample` | **FREE** | 1 search, 3 results — no wallet needed |
| `web_search` | **$0.02**/call | Full search, up to 10 results (Serper) |
| `web_synthesis` | **$0.10**/call | Multi-angle research synthesis: core + latest + critique (3 parallel searches) |

## Use (any MCP client, streamable HTTP)
```
POST https://<deployed-url>/mcp
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"x402 protocol"}}}
```
Unpaid calls → **HTTP 402** with a canonical base64 `PAYMENT-REQUIRED` header (x402 V2). Compatible agent clients retry with `PAYMENT-SIGNATURE`; the public XPay facilitator verifies and settles EIP-3009 USDC directly from buyer to seller on Base.

## Discovery surfaces
- `GET /health` — liveness + tiers
- `GET /.well-known/x402.json` — machine-readable payment manifest
- `GET /llms.txt` — LLM-readable service description

## Run locally
```bash
MOCK_MODE=1 npm install && npm start   # full 402 flow, mock settlement — no keys
npm test                                # 16-check E2E suite
```

## Production env
See `.env.example`. Requires: `SERPER_API_KEY`, `PAY_TO_ADDRESS` (Base wallet), and `PUBLIC_URL`. `X402_FACILITATOR_URL` optionally overrides the default public XPay facilitator. `ALCHEMY_URL` is only needed for the disabled-by-default manual tx-hash fallback.

## Telemetry
Every interaction is emitted as structured `[telemetry]` JSON to platform logs; local development also appends `telemetry/interactions.jsonl`. Durable analytics storage is intentionally not claimed yet.

Part of the Grokbot Autonomous Revenue system (`ranked-playbooks.md`).
