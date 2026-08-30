// JSONL telemetry — one line per 402 interaction. The A/B price loop + Tool-Feedback-Loop depend on this.
// B's day-one verdict: "Nothing is measured, so nothing is validated."
import { appendFile, mkdir } from "node:fs/promises";
import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { put } from "@vercel/blob";

const LOG_DIR = process.env.TELEMETRY_DIR || path.join(process.cwd(), "telemetry");

export function hashWallet(addr, key = process.env.TELEMETRY_HASH_KEY) {
  if (!addr) return null;
  if (!key) throw new Error("TELEMETRY_HASH_KEY is required to pseudonymize wallets");
  return createHmac("sha256", key).update(String(addr).toLowerCase()).digest("hex").slice(0, 32);
}

async function persistBlob(pathname, body) {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error("durable telemetry storage is not configured");
  }
  await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

export async function logEvent(evt, options = {}) {
  const now = options.now ? options.now() : new Date();
  const allowed = ["tool", "tier", "event", "method", "price_usd", "usdc_amount", "upstream_latency_ms", "result_count", "error"];
  const safeEvent = Object.fromEntries(allowed.filter((key) => evt[key] !== undefined).map((key) => [key, evt[key]]));
  const fromWallet = evt.from_wallet;
  const line = JSON.stringify({
    ...safeEvent,
    ...(fromWallet ? { wallet_hash: hashWallet(fromWallet, options.hashKey) } : {}),
    ts: now.toISOString(),
  });
  console.log(`[telemetry] ${line}`);
  const pathname = `telemetry/${now.toISOString().slice(0, 10)}/${now.toISOString().replace(/[.:]/g, "-")}-${randomUUID()}.json`;
  const persist = options.persist || persistBlob;
  const durableConfigured = Boolean(options.persist || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  const requireDurable = options.requireDurable ?? Boolean(process.env.VERCEL);
  if (durableConfigured || requireDurable) {
    const retryDelay = options.retryDelay || ((attempt) => new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt)));
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await persist(pathname, line);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await retryDelay(attempt);
      }
    }
    if (lastError) {
      console.error("[telemetry] durable write failed:", lastError.message);
      if (requireDurable) throw lastError;
    }
  }

  if (options.writeLocal !== false && !process.env.VERCEL) {
    try {
      await mkdir(LOG_DIR, { recursive: true });
      await appendFile(path.join(LOG_DIR, "interactions.jsonl"), line + "\n");
    } catch (e) {
      console.error("[telemetry] local JSONL write failed:", e.message);
    }
  }
  return line;
}
