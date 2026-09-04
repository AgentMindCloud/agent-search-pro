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
- AgentCash checks prove runtime x402 discovery compliance for the two paid HTTP routes.
- The remote MCP server is active in the official MCP Registry.

A standard signed `PAYMENT-SIGNATURE` purchase through facilitator verify and settle has not yet been independently verified. There is also no unaffiliated buyer, repeat purchase, or viable-unit-economics evidence.

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
