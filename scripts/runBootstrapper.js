import TronWeb from "tronweb";
import "dotenv/config";

/** Require env var or throw. */
function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimal ABI for LiquidityBootstrapper.bootstrapAndExecute() */
const BOOTSTRAPPER_ABI = [
  {
    inputs: [],
    name: "bootstrapAndExecute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

/** Wait until tx info is available or timeout. */
async function waitForTx(tronWeb, txid, { timeoutMs = 180000, pollMs = 4000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await tronWeb.trx.getTransactionInfo(txid);
    if (info && info.id) return info;
    await sleep(pollMs);
  }
  throw new Error(`Timeout waiting for tx: ${txid}`);
}

/**
 * Post JSON to Make webhook.
 * - Never silent
 * - Logs status code
 */
async function postToMake(url, payload) {
  if (!url) throw new Error("MAKE_WEBHOOK_URL is empty (not passed from GitHub Actions env).");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");
  console.log(`Make webhook response: ${res.status}`);
  if (!res.ok) throw new Error(`Make webhook failed: ${res.status} ${text}`);
}

(async () => {
  const startedAt = new Date().toISOString();

  const FULLNODE = process.env.TRON_FULLNODE || "https://api.trongrid.io";
  const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || "";

  const PRIVATE_KEY = must("TRON_PRIVATE_KEY");
  const BOOTSTRAPPER = must("BOOTSTRAPPER_ADDRESS");

  // IMPORTANT: we require this now (so it can't be silently missing)
  const MAKE_WEBHOOK_URL = must("MAKE_WEBHOOK_URL");

  // Fee limit in SUN (1 TRX = 1_000_000 SUN)
  const feeLimit = Number(process.env.FEE_LIMIT_SUN || 200_000_000);

  // TronWeb expects private key without 0x prefix
  const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY.slice(2) : PRIVATE_KEY;

  console.log("=== ENV CHECK ===");
  console.log("FULLNODE:", FULLNODE);
  console.log("BOOTSTRAPPER set:", !!BOOTSTRAPPER);
  console.log("MAKE_WEBHOOK_URL set:", !!MAKE_WEBHOOK_URL);
  console.log("=================");

  const tronWeb = new TronWeb({
    fullHost: FULLNODE,
    privateKey: pk,
    headers: TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": TRONGRID_API_KEY } : {},
  });

  const from = tronWeb.address.fromPrivateKey(pk);
  const contract = await tronWeb.contract(BOOTSTRAPPER_ABI, BOOTSTRAPPER);

  let txid = null;
  let result = "UNKNOWN";
  let errorMessage = null;

  try {
    console.log("From:", from);
    console.log("Bootstrapper:", BOOTSTRAPPER);

    // Send tx
    txid = await contract.bootstrapAndExecute().send({
      feeLimit,
      callValue: 0,
      shouldPollResponse: false,
    });

    console.log("TXID:", txid);

    // Confirm tx
    const info = await waitForTx(tronWeb, txid);
    result = info?.receipt?.result || "UNKNOWN";
    console.log("RESULT:", result);
  } catch (err) {
    errorMessage = String(err?.message || err);
    console.error("TX ERROR:", errorMessage);
  }

  const endedAt = new Date().toISOString();

  // Always send payload (success/revert/error)
  const payload = {
    ok: result === "SUCCESS",
    result,
    error: errorMessage,
    txid,
    tronscan: txid ? `https://tronscan.org/#/transaction/${txid}` : null,
    from,
    bootstrapper: BOOTSTRAPPER,
    startedAt,
    endedAt,
    node: FULLNODE,
    feeLimitSun: feeLimit,
  };

  console.log("Final payload:", payload);

  // Send to Make (will throw if missing / rejected)
  await postToMake(MAKE_WEBHOOK_URL, payload);

  // Exit code policy:
  // - If Make webhook fails -> job fails (so you notice)
  // - If tx reverted/failed but webhook delivered -> keep job green (optional)
  //   If you want red on REVERT, change this condition.
  if (!txid) process.exit(1);
})();
