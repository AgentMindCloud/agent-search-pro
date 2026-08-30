// On-chain settlement verification via Alchemy (no facilitator needed).
// Flow: buyer sends USDC directly to PAY_TO_ADDRESS (any wallet/app),
// then retries the tool call with X-PAYMENT-TX: <txhash>. We verify on Base
// that the tx transferred >= price USDC (ERC-20 Transfer event) to us, and
// that this tx hasn't been spent before (replay protection).
import { BASE_USDC, PAY_TO_ADDRESS } from "./config.js";
import { logEvent } from "./telemetry.js";

const ALCHEMY_URL = process.env.ALCHEMY_URL || "";

// In-memory spent-tx store (rebuilds on restart; on-chain check is the real gate)
const spentTx = new Set();

function topic(...hex32) {
  return "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)
}

export async function verifyTxPayment(txHash, priceUsd) {
  if (!ALCHEMY_URL) return { ok: false, error: "ALCHEMY_URL not configured" };
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || "")) return { ok: false, error: "invalid tx hash" };
  if (spentTx.has(txHash.toLowerCase())) return { ok: false, error: "tx already used (replay)" };

  const rpc = (method, params) =>
    fetch(ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    }).then((r) => r.json());

  const rc = await rpc("eth_getTransactionReceipt", [txHash]);
  if (rc.error) return { ok: false, error: `rpc: ${rc.error.message}` };
  const receipt = rc.result;
  if (!receipt || receipt.status !== "0x1") return { ok: false, error: "tx not found or failed" };

  const usdc = BASE_USDC.toLowerCase();
  const to = PAY_TO_ADDRESS.toLowerCase();
  const logs = receipt.logs || [];
  let paid = 0n;
  let from = null;
  for (const lg of logs) {
    if (lg.address?.toLowerCase() === usdc && lg.topics?.[0] === topic()) {
      const dst = "0x" + lg.topics[2].slice(26); // topic2 = to (padded)
      if (dst === to) {
        paid += BigInt(lg.data);
        from = "0x" + lg.topics[1].slice(26);
      }
    }
  }
  const needed = BigInt(Math.round(priceUsd * 1_000_000)); // USDC 6 decimals
  if (paid < needed) {
    return { ok: false, error: `insufficient: got ${Number(paid) / 1e6} USDC, need ${priceUsd}` };
  }
  spentTx.add(txHash.toLowerCase());
  await logEvent({ event: "tx_verified", tx: txHash, usdc_amount: Number(paid) / 1e6, from_wallet: from });
  return { ok: true, txHash, payer: from, amount: Number(paid) / 1e6 };
}
