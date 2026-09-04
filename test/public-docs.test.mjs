import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
assert.match(readme, /curl[^\n]+https:\/\/aggregator-beta\.vercel\.app\/api\/sample\?q=/, "README must include a one-command production free trial");
assert.match(readme, /https:\/\/aggregator-beta\.vercel\.app\/mcp/, "README must show the exact remote MCP endpoint");
assert.match(readme, /experimental/i, "README must label the service honestly during validation");
console.log("PASS public docs provide an exact free trial and MCP endpoint");
