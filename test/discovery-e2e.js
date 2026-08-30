import { spawn } from "node:child_process";

const PORT = 8794;
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
};

const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_MODE: "1", PORT: String(PORT), PUBLIC_URL: BASE },
  stdio: "pipe",
});
await new Promise((resolve) => {
  server.stdout.on("data", (d) => d.toString().includes("listening") && resolve());
  setTimeout(resolve, 3000);
});

try {
  const openapiRes = await fetch(`${BASE}/openapi.json`, { headers: { Origin: "https://supersignal.tech" } });
  const openapi = await openapiRes.json();
  check("OpenAPI is served", openapiRes.status === 200 && openapi.openapi === "3.1.0");
  check("CORS middleware is not global", openapiRes.headers.get("access-control-allow-origin") === null);
  check("OpenAPI has paid search", openapi.paths?.["/api/search"]?.post?.["x-payment-info"]?.price?.amount === "0.02");
  check("OpenAPI has paid synthesis", openapi.paths?.["/api/synthesis"]?.post?.["x-payment-info"]?.price?.amount === "0.10");
  check("OpenAPI declares input schema", openapi.paths?.["/api/search"]?.post?.requestBody?.content?.["application/json"]?.schema?.required?.includes("query"));
  check("Free sample is excluded from payment probing", Array.isArray(openapi.paths?.["/api/sample"]?.get?.security) && openapi.paths["/api/sample"].get.security.length === 0);
  check("OpenAPI has a contact URL", openapi.info?.contact?.url === "https://github.com/AgentMindCloud/agent-search-pro/issues");

  const icon = await fetch(`${BASE}/favicon.ico`);
  check("favicon is served", icon.status === 200 && (icon.headers.get("content-type") || "").includes("svg"));

  const wk = await fetch(`${BASE}/.well-known/x402`);
  const wkBody = await wk.json();
  check("extensionless well-known is served", wk.status === 200 && wkBody.resources?.length === 2);

  const unpaid = await fetch(`${BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "x402" }),
  });
  const encoded = unpaid.headers.get("payment-required");
  check("paid route returns 402", unpaid.status === 402);
  check("PAYMENT-REQUIRED is base64", !!encoded && !encoded.startsWith("{"));
  const required = JSON.parse(Buffer.from(encoded || "", "base64").toString("utf8") || "{}");
  check("V2 uses accepts", required.x402Version === 2 && Array.isArray(required.accepts) && required.accepts.length === 1);
  check("V2 uses atomic amount", required.accepts?.[0]?.amount === "20000");
  check("V2 names exact public resource", required.resource?.url === `${BASE}/api/search`);
  check("Bazaar input schema is present", required.extensions?.bazaar?.schema?.properties?.input?.type === "object");
  check("Bazaar output schema is present", required.extensions?.bazaar?.schema?.properties?.output?.type === "object");
  check("Bazaar probe body is valid", required.extensions?.bazaar?.info?.input?.body?.query === "x402 agent payments");

  const health = await fetch(`${BASE}/health`, { headers: { Origin: "https://supersignal.tech" } });
  check("health allows browser access", health.headers.get("access-control-allow-origin") === "*");

  const free = await fetch(`${BASE}/api/sample?q=x402`, { headers: { Origin: "https://supersignal.tech" } });
  const freeBody = await free.json();
  check("free REST sample works", free.status === 200 && freeBody.tier === "free" && freeBody.results?.length === 3);
  check("free sample allows browser access", free.headers.get("access-control-allow-origin") === "*");
} catch (e) {
  check("discovery test completed", false, e.message);
} finally {
  server.kill();
}

console.log(failures ? `\n${failures} FAILURES` : "\nALL DISCOVERY TESTS PASSED");
process.exit(failures ? 1 : 0);
