# Agent Search Pro — x402 Pay-Per-Call API + MCP Server

Live endpoint: **https://aggregator-beta.vercel.app**

Agent-native web search and research synthesis, paid per call in **USDC on Base** via [x402](https://x402.org). No buyer API keys, accounts, or subscriptions. Includes standard HTTP routes for x402 discovery plus a streamable HTTP MCP facade.

> Experimental beta. Verified: the website, free API/MCP path, canonical 402 challenges, durable telemetry, and a controlled direct-transfer 0.02 USDC fulfillment test. On 2026-09-04 UTC, one operator-funded signed `PAYMENT-SIGNATURE` search purchase through XPay verify and settle was verified end to end: HTTP 402, signed EIP-3009 authorization, successful Base settlement, HTTP 200, and eight live results ([transaction](https://basescan.org/tx/0x05d41f696732284339130d869cdc84b0d259f5122b9d61212bcd083675952555)). This proves the canonical paid `/api/search` path works, but it is not external demand. Paid synthesis has not been separately purchased on mainnet. There is no external paid demand or repeat buyer. See the [public validation baseline and fixed decision rule](VALIDATION.md).

## Tiers
| Tool | Price | What you get |
|------|-------|--------------|
| `web_search_sample` | **FREE** | 1 search, 3 results — no wallet needed |
| `web_search` | **$0.02**/call | Full search, up to 10 results (Serper) |
| `web_synthesis` | **$0.10**/call | Multi-angle research synthesis: core + latest + critique (3 parallel searches) |

## Try the live service in 10 seconds
No account, wallet, API key, or installation:

```bash
curl -s "https://aggregator-beta.vercel.app/api/sample?q=latest+AI+agent+payments"
```

The free route returns three live results. It is intentionally limited so agents can test output quality before deciding whether a paid call is worthwhile.

## Connect as a remote MCP server
Use this exact Streamable HTTP endpoint in any MCP client that supports remote servers:

```text
https://aggregator-beta.vercel.app/mcp
```

The MCP tools are `web_search_sample` (free), `web_search` ($0.02), and `web_synthesis` ($0.10). A raw JSON-RPC call looks like:

```http
POST https://aggregator-beta.vercel.app/mcp
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"web_search_sample","arguments":{"query":"x402 protocol"}}}
```

Paid calls return **HTTP 402** with a canonical base64 `PAYMENT-REQUIRED` header (x402 V2). Compatible agent clients retry with `PAYMENT-SIGNATURE`; the public XPay facilitator verifies and settles EIP-3009 USDC directly from buyer to seller on Base.

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
Every interaction is emitted as structured `[telemetry]` JSON to platform logs. Production writes one immutable JSON event to a private Vercel Blob store; local development also appends `telemetry/interactions.jsonl`. Wallets are represented only by keyed, pseudonymous identifiers; raw wallet and transaction hashes are excluded.

Part of [SuperSignal](https://supersignal.tech), an evidence-driven experiment in useful agent-native services.
