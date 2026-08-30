// x402 V2 constants — USDC on Base mainnet (chain 8453)
export const BASE_CHAIN_ID = "eip155:8453";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Coinbase CDP x402 facilitator (verifies + settles EIP-3009 USDC transfers)
export const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://facilitator.xpay.sh";

// Where money lands. In MOCK_MODE the wallet is a placeholder.
export const PAY_TO_ADDRESS =
  process.env.PAY_TO_ADDRESS || "0x000000000000000000000000000000000000dEaD";

// MOCK_MODE=1: 402 flow runs end-to-end but with a dev token; upstream Serper
// calls are mocked. No keys needed. Unset for production.
export const MOCK_MODE = process.env.MOCK_MODE === "1";

// Tier pricing (USD, per call) — market median $0.02 standard, premium synthesis $0.10
export const TIERS = {
  free: { price: 0, description: "Discovery/sample — no wallet needed" },
  standard: { price: 0.02, description: "Single web search, top results" },
  premium: { price: 0.10, description: "Multi-source synthesis report" },
};

// x402 V2 headers
export const H = {
  payReq: "PAYMENT-REQUIRED",
  paySig: "PAYMENT-SIGNATURE",
  payResp: "PAYMENT-RESPONSE",
  challenge: "X-PAYMENT-CHALLENGE",
  version: "X-PAYMENT-VERSION",
};

export const SERPER_KEY = process.env.SERPER_API_KEY || "";
export const SERPER_URL = "https://google.serper.dev/search";
