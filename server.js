// Agent Search Pro - x402 V2 HTTP API + MCP server.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { TIERS, MOCK_MODE } from "./src/config.js";
import {
  toolSample, toolSearch, toolSynthesis, make402,
  verifyPayment, settlePayment, paymentResponseHeader, buildPaymentRequirement,
} from "./src/tools.js";
import { verifyTxPayment } from "./src/settlement.js";
import { logEvent } from "./src/telemetry.js";
import { openApiDocument, wellKnown } from "./src/discovery.js";

const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.PUBLIC_URL || "https://aggregator-beta.vercel.app";
const app = new Hono();
const publicGetCors = cors({ origin: "*" });

const TOOL_DEFS = [
  { name: "web_search_sample", description: "FREE: one live web search, 3 results.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "web_search", description: "PAID $0.02 USDC on Base: live web search, up to 10 results.", inputSchema: { type: "object", properties: { query: { type: "string" }, num: { type: "integer", minimum: 1, maximum: 10 } }, required: ["query"] } },
  { name: "web_synthesis", description: "PAID $0.10 USDC on Base: current results, latest developments, and counterpoints.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
];
const IMPLS = {
  web_search_sample: { fn: toolSample, tier: "free", resource: "/api/sample", description: "Free web search sample" },
  web_search: { fn: toolSearch, tier: "standard", resource: "/api/search", description: "Live web search" },
  web_synthesis: { fn: toolSynthesis, tier: "premium", resource: "/api/synthesis", description: "Three-angle research synthesis" },
};

const jsonHeaders = (headers = {}) => ({ ...headers, "Access-Control-Allow-Origin": "*" });
const challenge = async (c, price, resourceUrl, description, responseBody, telemetryTool = description) => {
  const p = make402(price, resourceUrl, description);
  await logEvent({ tool: telemetryTool, event: "402_quote", price_usd: price });
  return c.json(responseBody ? responseBody(p.body) : p.body, 402, jsonHeaders(p.headers));
};

async function executePaid(c, { price, resourceUrl, description, toolName, fn, args, wrap }) {
  const txHash = c.req.header("x-payment-tx");
  if (txHash && (MOCK_MODE || process.env.ALLOW_TX_HASH_FALLBACK === "1")) {
    const checked = await verifyTxPayment(txHash, price);
    await logEvent({ tool: toolName, event: checked.ok ? "paid_call" : "settle_failed", method: "onchain_tx", price_usd: price, tx: txHash, error: checked.error || null });
    if (!checked.ok) return challenge(c, price, resourceUrl, description, () => ({ error: `Payment verification failed: ${checked.error}` }));
    const output = await fn(args);
    return c.json(wrap(output, { method: "onchain_tx", transaction: txHash }), 200, jsonHeaders());
  }

  const signature = c.req.header("payment-signature");
  if (!signature) return challenge(c, price, resourceUrl, description, wrap.challenge, toolName);

  const requirement = buildPaymentRequirement(price);
  const verified = await verifyPayment(signature, requirement);
  if (!verified.ok) {
    await logEvent({ tool: toolName, event: "verify_failed", price_usd: price, error: verified.error || null });
    return challenge(c, price, resourceUrl, description, wrap.challenge);
  }

  let output;
  try { output = await fn(args); }
  catch (error) {
    await logEvent({ tool: toolName, event: "tool_failed", price_usd: price, error: error.message });
    return c.json({ error: `Tool error: ${error.message}` }, 500);
  }

  const settled = await settlePayment(verified.payload, requirement);
  await logEvent({
    tool: toolName, event: settled.ok ? "paid_call" : "settle_failed", method: "x402_v2",
    price_usd: price, from_wallet: settled.payer || null,
    tx: settled.transaction || null, error: settled.error || null,
  });
  const responseHeader = paymentResponseHeader(settled);
  if (!settled.ok) return c.json({ error: settled.error || "Settlement failed" }, 402, jsonHeaders({ "PAYMENT-RESPONSE": responseHeader }));
  return c.json(wrap(output, { method: "x402_v2", transaction: settled.transaction }), 200, jsonHeaders({ "PAYMENT-RESPONSE": responseHeader }));
}

// Discovery and free routes.
app.get("/health", publicGetCors, (c) => c.json({ ok: true, service: "agent-search-pro", version: "0.2.0", mock: MOCK_MODE, tiers: TIERS, facilitator: "xpay", ts: new Date().toISOString() }));
app.get("/favicon.ico", (c) => c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111827"/><path d="M15 42 29 14h7L25 34h12l-5 16 17-26H37l5-10h7L35 50h-9l5-16H20l-5 8Z" fill="#60a5fa"/></svg>`, 200, { "Content-Type": "image/svg+xml", "Cache-Control": "public,max-age=86400" }));
app.get("/openapi.json", (c) => c.json(openApiDocument(ORIGIN)));
app.get("/.well-known/x402", (c) => c.json(wellKnown(ORIGIN)));
app.get("/.well-known/x402.json", (c) => c.json(wellKnown(ORIGIN)));
app.get("/llms.txt", (c) => c.text(`# Agent Search Pro\nFree sample: GET ${ORIGIN}/api/sample?q=x402\nPaid search: POST ${ORIGIN}/api/search ($0.02 USDC)\nPaid synthesis: POST ${ORIGIN}/api/synthesis ($0.10 USDC)\nOpenAPI: ${ORIGIN}/openapi.json\nMCP: ${ORIGIN}/mcp\nContact: api@supersignal.tech\n`));
app.get("/api/sample", publicGetCors, async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "q is required" }, 400);
  await logEvent({ tool: "web_search_sample", tier: "free", event: "call" });
  return c.json(await toolSample({ query }));
});

function restPaid(path, toolName) {
  const impl = IMPLS[toolName];
  app.post(path, async (c) => {
    const price = TIERS[impl.tier].price;
    const resourceUrl = `${ORIGIN}${path}`;
    // Payment challenge happens before body validation, so discovery probes see 402.
    if (!c.req.header("payment-signature") && !(c.req.header("x-payment-tx") && (MOCK_MODE || process.env.ALLOW_TX_HASH_FALLBACK === "1"))) {
      return challenge(c, price, resourceUrl, impl.description, undefined, toolName);
    }
    let args;
    try { args = await c.req.json(); } catch { return c.json({ error: "JSON body required" }, 400); }
    if (!args.query || typeof args.query !== "string") return c.json({ error: "query is required" }, 400);
    return executePaid(c, { price, resourceUrl, description: impl.description, toolName, fn: impl.fn, args, wrap: (out, payment) => ({ ...out, payment }) });
  });
}
restPaid("/api/search", "web_search");
restPaid("/api/synthesis", "web_synthesis");

// Streamable HTTP MCP facade.
let sessionCounter = 0;
app.post("/mcp", async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }, 400); }
  const { id, method } = body;
  const rpc = (result, status = 200, headers = {}) => c.json({ jsonrpc: "2.0", id, result }, status, headers);
  if (method === "initialize") {
    return rpc({ protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "agent-search-pro", version: "0.2.0" } }, 200, { "mcp-session-id": `sess_${Date.now().toString(36)}_${++sessionCounter}` });
  }
  if (method === "tools/list") return rpc({ tools: TOOL_DEFS });
  if (method !== "tools/call") return c.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }, 404);

  const toolName = body.params?.name;
  const impl = IMPLS[toolName];
  if (!impl) return c.json({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${toolName}` } }, 400);
  const args = body.params?.arguments || {};
  if (impl.tier === "free") {
    await logEvent({ tool: toolName, tier: "free", event: "call" });
    const out = await impl.fn(args);
    return rpc({ content: [{ type: "text", text: JSON.stringify(out) }] });
  }
  const price = TIERS[impl.tier].price;
  return executePaid(c, {
    price, resourceUrl: `${ORIGIN}${impl.resource}`, description: impl.description, toolName, fn: impl.fn, args,
    wrap: Object.assign(
      (out, payment) => ({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ ...out, payment }) }] } }),
      { challenge: (payment) => ({ jsonrpc: "2.0", id, error: { code: 402, message: "Payment required", data: payment } }) },
    ),
  });
});
app.get("/mcp", (c) => c.json({ error: "POST only" }, 405));

if (!process.env.VERCEL) {
  serve({ fetch: app.fetch, port: PORT }, (info) => console.log(`Agent Search Pro listening on http://localhost:${info.port} (MOCK_MODE=${MOCK_MODE})`));
}

export default app;
