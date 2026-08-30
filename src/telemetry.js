// JSONL telemetry — one line per 402 interaction. The A/B price loop + Tool-Feedback-Loop depend on this.
// B's day-one verdict: "Nothing is measured, so nothing is validated."
import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const LOG_DIR = process.env.TELEMETRY_DIR || path.join(process.cwd(), "telemetry");

export function hashWallet(addr) {
  if (!addr) return null;
  return createHash("sha256").update(String(addr).toLowerCase()).digest("hex").slice(0, 16);
}

export async function logEvent(evt) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...evt,
  });
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(path.join(LOG_DIR, "interactions.jsonl"), line + "\n");
  } catch (e) {
    console.error("[telemetry] write failed:", e.message);
  }
  return line;
}
