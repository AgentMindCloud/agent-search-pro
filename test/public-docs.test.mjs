import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const validation = await readFile(new URL("../VALIDATION.md", import.meta.url), "utf8");
assert.match(readme, /curl[^\n]+https:\/\/aggregator-beta\.vercel\.app\/api\/sample\?q=/, "README must include a one-command production free trial");
assert.match(readme, /https:\/\/aggregator-beta\.vercel\.app\/mcp/, "README must show the exact remote MCP endpoint");
assert.match(readme, /VALIDATION\.md/, "README must link the public validation baseline");
assert.match(readme, /experimental/i, "README must label the service honestly during validation");
assert.match(validation, /301 total telemetry events/i, "validation baseline must publish the exact event count");
assert.match(validation, /0 externally paid calls/i, "validation baseline must disclose zero external revenue");
assert.match(validation, /2026-09-06T11:22:00Z/, "validation baseline must publish the fixed decision time");
console.log("PASS public docs provide an exact free trial, MCP endpoint, and honest validation baseline");
