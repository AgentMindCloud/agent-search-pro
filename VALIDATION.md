# Public validation status

Agent Search Pro is a live experiment, not a proven business. This page records the precommitted baseline and decision rule so that crawler traffic is not mistaken for demand.

## Baseline

Snapshot time: `2026-09-04T13:29:58Z`

- **301 total telemetry events** in the private durable store
- **290** unpaid `402_quote` events
- **11** free calls
- **0 externally paid calls**
- **$0 external revenue**
- **0** external repeat buyers

Most quote events arrive as near-hourly search/synthesis pairs. They are consistent with automated discovery probes and are not counted as customers, conversions, or revenue.

## What has actually been proven

- Local mock-mode API, MCP, discovery, deployment-policy, documentation, and telemetry tests pass.
- One operator-funded direct-transfer dogfood transaction proved the Base USDC receipt-check and fulfillment path.
- One operator-funded signed x402 search purchase proved the standard `PAYMENT-SIGNATURE` path end to end: an official x402 client received HTTP 402, signed an EIP-3009 authorization, XPay verified and settled it, Base transferred 0.02 USDC to the configured service wallet, and `/api/search` returned HTTP 200 with eight live results.
- One operator-funded signed x402 synthesis purchase proved the same standard path on the second paid route: Base transferred 0.10 USDC and `/api/synthesis` returned HTTP 200 with three research angles and 15 live sources.
- AgentCash checks prove runtime x402 discovery compliance for the two paid HTTP routes.
- The remote MCP server is active in the official MCP Registry.

### Canonical signed x402 proofs (operator-funded; excluded from demand)

#### Paid search

- Block time: `2026-09-04T18:05:29Z`
- Base transaction: [`0x05d41f696732284339130d869cdc84b0d259f5122b9d61212bcd083675952555`](https://basescan.org/tx/0x05d41f696732284339130d869cdc84b0d259f5122b9d61212bcd083675952555)
- Route: `POST /api/search`
- Buyer: disposable DPAPI-encrypted wallet, funded by the operator with exactly 0.02 USDC
- Client: official `@x402/fetch` and `@x402/evm` version `2.25.0`
- Facilitator: `https://facilitator.xpay.sh`
- On-chain result: successful 0.02 USDC transfer from buyer to configured recipient
- Delivery result: HTTP 200 and eight live web results
- Durable telemetry result: `paid_call`, method `x402_v2`, price `0.02`
- Public proof artifact: [`proofs/x402-search-2026-09-04.json`](proofs/x402-search-2026-09-04.json)

#### Paid synthesis

- Block time: `2026-09-04T18:54:27Z`
- Base transaction: [`0x67bae3bafd3e93ec671a2ec516b3ac3826603938d8518a18b97dc221e3eadc9a`](https://basescan.org/tx/0x67bae3bafd3e93ec671a2ec516b3ac3826603938d8518a18b97dc221e3eadc9a)
- Route: `POST /api/synthesis`
- Buyer: the same disposable operator-funded wallet, funded with exactly 0.10 USDC
- Client: official `@x402/fetch` and `@x402/evm` version `2.25.0`
- Facilitator: `https://facilitator.xpay.sh`
- On-chain result: successful 0.10 USDC transfer from buyer to configured recipient
- Delivery result: HTTP 200, three research angles, and 15 live sources
- Durable telemetry result: `paid_call`, method `x402_v2`, price `0.10`
- Public proof artifact: [`proofs/x402-synthesis-2026-09-04.json`](proofs/x402-synthesis-2026-09-04.json)

These establish that both canonical paid routes work technically. They are controlled operator-funded engineering proofs, not customer revenue or market demand. There is still no unaffiliated buyer, repeat purchase, or viable-unit-economics evidence.

## Clean demand window

- Clean baseline: `2026-09-04T13:29:58Z`, 301 events
- Fixed decision time: `2026-09-06T11:22:00Z`
- Operator sample calls and self-payments are excluded.
- Repeated probe-shaped 402 responses are excluded from demand.

During this window the service is exposed through its free sample, x402scan/Poncho, the official MCP Registry, GitHub release `v0.2.0`, and a pending submission to `punkpeye/awesome-mcp-servers`.

## Precommitted decision

1. **At least one unaffiliated paid call:** treat it only as a first-revenue signal; reconcile delivery and costs, then seek an unprompted repeat.
2. **At least three credible external free trials but no payment:** run one bounded 72-hour value/trust/payment-friction test; do not automatically lower price.
3. **No credible external use or payment:** stop active development of the generic search offer. Keep the infrastructure as a reusable test bed and do not spend additional weeks adding features.
4. **Crawler/discovery quotes only:** count as visibility, not demand.

## Verifiable public surfaces

- Live service: https://aggregator-beta.vercel.app
- Free sample: https://aggregator-beta.vercel.app/api/sample?q=agent+payments
- MCP Registry entry: https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.AgentMindCloud%2Fagent-search-pro
- x402 merchant page: https://tryponcho.com/m/aggregator-beta.vercel.app
- Public catalog submission: https://github.com/punkpeye/awesome-mcp-servers/pull/13625
