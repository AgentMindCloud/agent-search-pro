const querySchema = {
  type: "object",
  properties: {
    query: { type: "string", minLength: 1, description: "The web search or research query" },
    num: { type: "integer", minimum: 1, maximum: 10, description: "Maximum search results (search only)" },
  },
  required: ["query"],
  additionalProperties: false,
};

const resultSchema = {
  type: "object",
  properties: {
    tool: { type: "string" },
    tier: { type: "string" },
    price_usd: { type: "number" },
    query: { type: "string" },
    results: { type: "array", items: { type: "object" } },
    synthesis: { type: "array", items: { type: "object" } },
  },
  required: ["tool", "tier", "price_usd"],
};

function operation(id, summary, amount) {
  return {
    operationId: id,
    summary,
    tags: ["Paid agent search"],
    "x-payment-info": {
      price: { mode: "fixed", currency: "USD", amount },
      protocols: [{ x402: {} }],
    },
    requestBody: {
      required: true,
      content: { "application/json": { schema: querySchema, example: { query: "x402 agent payments" } } },
    },
    responses: {
      "200": { description: "Paid result", content: { "application/json": { schema: resultSchema } } },
      "400": { description: "Invalid request" },
      "402": { description: "Payment Required" },
      "500": { description: "Upstream error" },
    },
  };
}

export function openApiDocument(origin) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Agent Search Pro",
      version: "0.2.0",
      description: "Experimental beta for agent-native web search and multi-angle research synthesis paid per call in USDC on Base. Free access and canonical x402 challenges are verified. Operator-funded signed x402 purchases completed on both paid routes through facilitator verify and settle, proving their technical operation. External paid demand is not validated.",
      contact: {
        email: "api@supersignal.tech",
        url: "https://github.com/AgentMindCloud/agent-search-pro/issues",
      },
      "x-guidance": "Use POST /api/search for a normal web search ($0.02). Use POST /api/synthesis when the task needs current results, recent developments, and counterpoints ($0.10). GET /api/sample?q=... is free.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/search": { post: operation("webSearch", "Search the live web", "0.02") },
      "/api/synthesis": { post: operation("webSynthesis", "Run a three-angle research synthesis", "0.10") },
      "/api/sample": {
        get: {
          operationId: "webSearchSample",
          summary: "Free three-result web search sample",
          security: [],
          parameters: [{ in: "query", name: "q", required: true, schema: { type: "string", minLength: 1 } }],
          responses: { "200": { description: "Free sample", content: { "application/json": { schema: resultSchema } } } },
        },
      },
    },
  };
}

export function wellKnown(origin) {
  return {
    version: 1,
    x402Version: 2,
    resources: [`${origin}/api/search`, `${origin}/api/synthesis`],
    routes: [
      { method: "POST", path: "/api/search", url: `${origin}/api/search`, price: "0.02", currency: "USD" },
      { method: "POST", path: "/api/synthesis", url: `${origin}/api/synthesis`, price: "0.10", currency: "USD" },
    ],
  };
}
