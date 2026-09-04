// Local E2E — verifies the full 402 flow against a MOCK_MODE server.
// Usage: node test/local-e2e.js [port]  (starts its own server on an ephemeral port)
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
};

const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_MODE: "1", PORT: String(PORT), TELEMETRY_HASH_KEY: "local-test-key", TELEMETRY_DIR: path.join(os.tmpdir(), `x402-telemetry-test-${Date.now()}`) },
  stdio: "pipe",
});
await new Promise((r) => {
  server.stdout.on("data", (d) => d.toString().includes("listening") && r());
  setTimeout(r, 3000);
});

const j = (r) => r.json();
const post = (body, headers = {}) => fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

try {
  // 1. health
  const h = await (await fetch(`${BASE}/health`)).json();
  check("health endpoint", h.ok === true && h.mock === true);

  // 2. discovery surfaces
  const wk = await (await fetch(`${BASE}/.well-known/x402.json`)).json();
  check("x402 well-known", wk.resources?.includes("https://aggregator-beta.vercel.app/api/search") && wk.x402Version === 2);
  const llms = await (await fetch(`${BASE}/llms.txt`)).text();
  check("llms.txt", llms.includes("/api/search") && llms.includes("USDC") && llms.includes("api@supersignal.tech"));
  check("llms.txt states the exact signed-settlement evidence boundary", llms.includes("Experimental beta") && llms.includes("Signed facilitator settlement: verified for operator-funded /api/search and /api/synthesis purchases") && llms.includes("0x67bae3bafd3e93ec671a2ec516b3ac3826603938d8518a18b97dc221e3eadc9a") && llms.includes("External paid demand: not validated"));

  // 3. initialize + session
  const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const sid = init.headers.get("mcp-session-id");
  check("initialize returns session", !!sid);
  const initBody = await j(init);
  check("serverInfo", initBody.result?.serverInfo?.name === "agent-search-pro");

  // 4. tools/list
  const tl = await j(await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
  const names = tl.result?.tools?.map((t) => t.name);
  check("tools/list has 3 tiers", JSON.stringify(names) === JSON.stringify(["web_search_sample", "web_search", "web_synthesis"]));

  // 5. FREE call — no payment
  const free = await j(await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "web_search_sample", arguments: { query: "x402 protocol" } } }));
  const freeOut = JSON.parse(free.result?.content?.[0]?.text || "{}");
  check("free sample works w/o payment", freeOut.tier === "free" && Array.isArray(freeOut.results) && freeOut.results.length === 3);

  // 6. PAID call without payment -> 402
  const r402 = await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "web_search", arguments: { query: "x402" } } });
  const b402 = await j(r402);
  check("unpaid -> HTTP 402", r402.status === 402, `got ${r402.status}`);
  const pr = b402.error?.data?.accepts?.[0];
  check("402 carries x402 V2 requirements", pr?.network === "eip155:8453" && pr?.payTo?.startsWith("0x") && pr?.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" && pr?.amount === "20000");
  const encodedRequired = r402.headers.get("payment-required");
  check("402 header challenge present", !!encodedRequired);
  const decodedRequired = JSON.parse(Buffer.from(encodedRequired, "base64").toString("utf8"));
  check("402 header is canonical V2", decodedRequired.x402Version === 2 && decodedRequired.accepts?.[0]?.amount === "20000");

  // 7. PAID call with mock settlement header
  const paid = await post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "web_synthesis", arguments: { query: "autonomous agent payments" } } }, { "PAYMENT-SIGNATURE": "mock-dev-token" });
  const paidBody = await j(paid);
  const paidOut = JSON.parse(paidBody.result?.content?.[0]?.text || "{}");
  check("paid call after settlement", paid.status === 200 && paidOut.tier === "premium" && paidOut.synthesis?.length === 3, `status=${paid.status}`);
  check("premium output has 3 angles + sources", paidOut.total_sources >= 9);

  // 8. telemetry file
  await new Promise((r) => setTimeout(r, 300));
  const tdir = server.spawnargs ? process.env.TELEMETRY_DIR : null;
  const env = server.spawnargs && Object.fromEntries(Object.entries(server.spawnargs)) ; // noop
  const logPath = path.join(os.tmpdir(), ...[...fs_find()]);
  function fs_find() { return []; }
  // read via the env we passed
  const { readdir } = await import("node:fs/promises");
  const tmpDirs = await readdir(os.tmpdir());
  const tdirFound = tmpDirs.filter((d) => d.startsWith("x402-telemetry-test-")).sort().pop();
  const log = await readFile(path.join(os.tmpdir(), tdirFound, "interactions.jsonl"), "utf8");
  const events = log.trim().split("\n").map((l) => JSON.parse(l));
  const evTypes = events.map((e) => e.event + ":" + e.tool);
  check("telemetry logged free call", evTypes.includes("call:web_search_sample"));
  check("telemetry logged 402 quote", evTypes.includes("402_quote:web_search"));
  check("telemetry logged paid call", evTypes.includes("paid_call:web_synthesis"));
  const paidEv = events.find((e) => e.event === "paid_call");
  check("telemetry records price without raw tx", paidEv?.price_usd === 0.1 && paidEv?.tx === undefined && !!paidEv?.wallet_hash);
} catch (e) {
  check("E2E ran without exception", false, e.message);
} finally {
  server.kill();
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
