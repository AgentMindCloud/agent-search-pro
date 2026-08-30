// Quick check of the Alchemy settlement verification path.
import { verifyTxPayment } from "../src/settlement.js";

// 1. Garbage hash -> must be rejected as not-found
const r1 = await verifyTxPayment("0x" + "11".repeat(32), 0.02);
console.log("garbage hash (expect tx-not-found):", JSON.stringify(r1));

// 2. Malformed hash -> must be rejected
const r2 = await verifyTxPayment("0x123", 0.02);
console.log("malformed (expect invalid):", JSON.stringify(r2));
