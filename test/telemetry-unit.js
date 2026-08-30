import assert from "node:assert/strict";
import { logEvent } from "../src/telemetry.js";

const writes = [];
const event = { tool: "web_search_sample", tier: "free", event: "call" };
const line = await logEvent(event, {
  now: () => new Date("2026-08-30T09:00:00.000Z"),
  persist: async (pathname, body) => writes.push({ pathname, body }),
  writeLocal: false,
});

assert.equal(writes.length, 1, "writes each event to durable storage");
assert.match(writes[0].pathname, /^telemetry\/2026-08-30\/2026-08-30T09-00-00-000Z-[0-9a-f-]+\.json$/);
assert.deepEqual(JSON.parse(writes[0].body), {
  ts: "2026-08-30T09:00:00.000Z",
  ...event,
});
assert.equal(writes[0].body, line);

const privateWrites = [];
await logEvent({ event: "tx_verified", from_wallet: "0xABCDEF", wallet_hash: "attacker-controlled", tx: "0xrawtx", ts: "untrusted" }, {
  hashKey: "test-telemetry-key",
  now: () => new Date("2026-08-30T09:01:00.000Z"),
  persist: async (pathname, body) => privateWrites.push({ pathname, body }),
  writeLocal: false,
});
const privateEvent = JSON.parse(privateWrites[0].body);
assert.equal(privateEvent.from_wallet, undefined, "does not persist a raw wallet address");
assert.equal(privateEvent.tx, undefined, "does not persist a raw transaction hash");
assert.equal(privateEvent.ts, "2026-08-30T09:01:00.000Z", "does not allow events to override the trusted timestamp");
assert.equal(privateEvent.wallet_hash, "e940d5bcc23c6f7d40750723b6666a70", "persists only a keyed pseudonymous wallet identifier");

const bypassWrites = [];
await logEvent({ event: "call", wallet_hash: "attacker-controlled" }, {
  now: () => new Date("2026-08-30T09:01:30.000Z"),
  persist: async (pathname, body) => bypassWrites.push({ pathname, body }),
  writeLocal: false,
});
assert.equal(JSON.parse(bypassWrites[0].body).wallet_hash, undefined, "rejects caller-supplied wallet pseudonyms");

let failedAttempts = 0;
await assert.rejects(
  logEvent({ event: "call" }, {
    now: () => new Date("2026-08-30T09:02:00.000Z"),
    persist: async () => { failedAttempts++; throw new Error("store unavailable"); },
    requireDurable: true,
    retryDelay: async () => {},
    writeLocal: false,
  }),
  /store unavailable/,
  "production telemetry fails closed when durable storage is unavailable",
);
assert.equal(failedAttempts, 3, "retries a durable write before failing closed");

console.log("PASS durable telemetry writes one immutable event object");
console.log("PASS telemetry anonymizes wallet addresses before persistence");
console.log("PASS production telemetry retries and fails closed");
