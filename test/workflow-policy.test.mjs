import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/heartbeat.yml", import.meta.url), "utf8");
assert.match(workflow, /https:\/\/aggregator-beta\.vercel\.app\/health/, "monitor must use the public URL without an unset secret");
assert.doesNotMatch(workflow, /PUBLIC_URL/, "public monitor must not depend on an unset GitHub secret");
assert.doesNotMatch(workflow, /\/mcp|\/api\/sample/, "monitor must not create synthetic product-usage events");
assert.doesNotMatch(workflow, /paid call|HEARTBEAT_WALLET_KEY/i, "monitor must not manufacture paid demand");
console.log("PASS uptime workflow checks health without polluting demand telemetry");
