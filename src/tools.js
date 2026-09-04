// Upstream calls + standards-compliant x402 V2 payment helpers.
import { SERPER_KEY, SERPER_URL, MOCK_MODE, PAY_TO_ADDRESS, BASE_CHAIN_ID, BASE_USDC, FACILITATOR_URL } from "./config.js";
import { logEvent } from "./telemetry.js";

async function serperSearch(query, num = 5) {
  const t0 = Date.now();
  if (MOCK_MODE || !SERPER_KEY) {
    return {
      body: {
        searchParameters: { q: query, num },
        organic: Array.from({ length: num }, (_, i) => ({
          title: `[MOCK] Result ${i + 1} for "${query}"`,
          link: `https://example.com/mock-${i + 1}`,
          snippet: `Mocked result ${i + 1}; set SERPER_API_KEY for live data.`,
        })),
        mocked: true,
      },
      latency_ms: Date.now() - t0,
    };
  }
  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text()}`);
  return { body: await res.json(), latency_ms: Date.now() - t0 };
}

export async function toolSample(args) {
  const { body } = await serperSearch(args.query || "what is x402", 3);
  return {
    tool: "web_search_sample", tier: "free", price_usd: 0,
    results: body.organic?.slice(0, 3) ?? [],
    note: "Free sample. Paid: $0.02 search, $0.10 synthesis.",
  };
}

export async function toolSearch(args) {
  const { body, latency_ms } = await serperSearch(args.query, Math.min(Math.max(args.num || 10, 1), 10));
  await logEvent({ tool: "web_search", tier: "standard", upstream_latency_ms: latency_ms, result_count: body.organic?.length });
  return { tool: "web_search", tier: "standard", price_usd: 0.02, query: args.query, results: body.organic ?? [], mocked: body.mocked === true };
}

export async function toolSynthesis(args) {
  const topics = [args.query, `${args.query} latest news 2026`, `${args.query} analysis criticism`];
  const runs = await Promise.all(topics.map((q) => serperSearch(q, 5)));
  await logEvent({
    tool: "web_synthesis", tier: "premium",
    upstream_latency_ms: Math.max(...runs.map((r) => r.latency_ms)),
    result_count: runs.reduce((n, r) => n + (r.body.organic?.length ?? 0), 0),
  });
  return {
    tool: "web_synthesis", tier: "premium", price_usd: 0.10, query: args.query,
    synthesis: topics.map((_, i) => ({
      angle: ["core results", "latest developments", "critique & counterpoints"][i],
      results: runs[i].body.organic?.slice(0, 5) ?? [],
    })),
    total_sources: runs.reduce((n, r) => n + (r.body.organic?.length ?? 0), 0),
    mocked: runs[0].body.mocked === true,
  };
}

export function buildPaymentRequirement(priceUsd) {
  return {
    scheme: "exact",
    network: BASE_CHAIN_ID,
    amount: String(Math.round(priceUsd * 1_000_000)),
    asset: BASE_USDC,
    payTo: PAY_TO_ADDRESS,
    maxTimeoutSeconds: 60,
    extra: { name: "USD Coin", version: "2", assetTransferMethod: "eip3009", paymentFlow: "authorization" },
  };
}

// Compatibility alias used by older local code.
export function buildPaymentRequirements(priceUsd) {
  return [buildPaymentRequirement(priceUsd)];
}

const b64 = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const unb64 = (value) => JSON.parse(Buffer.from(value, "base64").toString("utf8"));

const BAZAAR_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    input: {
      type: "object",
      properties: {
        type: { type: "string", const: "http" },
        method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
        bodyType: { type: "string", enum: ["json", "form-data", "text"] },
        body: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1 },
            num: { type: "integer", minimum: 1, maximum: 10 },
          },
          required: ["query"],
        },
      },
      required: ["type", "method", "bodyType", "body"],
      additionalProperties: false,
    },
    output: {
      type: "object",
      properties: { type: { type: "string" }, example: { type: "object" } },
      required: ["type"],
    },
  },
  required: ["input", "output"],
};

export function make402(priceUsd, resourceUrl = `${process.env.PUBLIC_URL || "https://aggregator-beta.vercel.app"}/mcp`, description = "Agent web search") {
  const synthesis = priceUsd >= 0.10;
  const body = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: resourceUrl,
      description,
      mimeType: "application/json",
      serviceName: "Agent Search Pro",
      tags: ["search", "research", "agents", "x402"],
    },
    accepts: [buildPaymentRequirement(priceUsd)],
    extensions: {
      bazaar: {
        info: {
          input: { type: "http", method: "POST", bodyType: "json", body: { query: "x402 agent payments", ...(synthesis ? {} : { num: 10 }) } },
          output: { type: "json", example: synthesis ? { tool: "web_synthesis", tier: "premium", synthesis: [] } : { tool: "web_search", tier: "standard", results: [] } },
        },
        schema: BAZAAR_SCHEMA,
      },
    },
  };
  return {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": b64(body),
      // Compatibility for older crawlers while PAYMENT-REQUIRED remains canonical.
      "X-PAYMENT-CHALLENGE": b64(body),
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED,PAYMENT-RESPONSE",
    },
    body,
  };
}

function facilitatorBody(paymentPayload, paymentRequirement) {
  return { x402Version: 2, paymentPayload, paymentRequirements: paymentRequirement };
}

export async function verifyPayment(paymentHeader, paymentRequirement) {
  if (MOCK_MODE) return { ok: true, payer: "0x0000000000000000000000000000000000000001", payload: { mock: true } };
  let paymentPayload;
  try { paymentPayload = unb64(paymentHeader); }
  catch { return { ok: false, error: "invalid PAYMENT-SIGNATURE encoding" }; }
  const res = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(facilitatorBody(paymentPayload, paymentRequirement)),
  });
  if (!res.ok) return { ok: false, error: `facilitator verify ${res.status}: ${await res.text()}` };
  const data = await res.json();
  return { ok: data.isValid === true || data.valid === true, payer: data.payer, payload: paymentPayload, error: data.invalidReason || data.reason };
}

export async function settlePayment(paymentPayloadOrHeader, paymentRequirement) {
  if (MOCK_MODE) {
    return { ok: true, success: true, transaction: "0x" + "ab".repeat(32), network: BASE_CHAIN_ID, payer: "0x0000000000000000000000000000000000000001" };
  }
  let paymentPayload = paymentPayloadOrHeader;
  if (typeof paymentPayloadOrHeader === "string") {
    try { paymentPayload = unb64(paymentPayloadOrHeader); }
    catch { return { ok: false, error: "invalid PAYMENT-SIGNATURE encoding" }; }
  }
  const res = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(facilitatorBody(paymentPayload, paymentRequirement)),
  });
  if (!res.ok) return { ok: false, error: `facilitator settle ${res.status}: ${await res.text()}` };
  const data = await res.json();
  return {
    ok: data.success === true || data.settled === true,
    success: data.success === true || data.settled === true,
    transaction: data.transaction || data.txHash || "",
    network: data.network || BASE_CHAIN_ID,
    payer: data.payer,
    error: data.errorReason || data.reason,
  };
}

export function paymentResponseHeader(settlement) {
  return b64({
    success: settlement.success === true,
    transaction: settlement.transaction || "",
    network: settlement.network || BASE_CHAIN_ID,
    ...(settlement.payer ? { payer: settlement.payer } : {}),
    ...(settlement.error ? { errorReason: settlement.error } : {}),
  });
}
