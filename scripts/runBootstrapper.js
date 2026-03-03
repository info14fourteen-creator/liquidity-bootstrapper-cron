import TronWeb from "tronweb";
import "dotenv/config";

/**
 * Returns required env var value or throws.
 */
function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * Sleep helper for polling.
 */
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Minimal ABI for LiquidityBootstrapper.bootstrapAndExecute()
 */
const BOOTSTRAPPER_ABI = [
  {
    inputs: [],
    name: "bootstrapAndExecute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

/**
 * Waits until tx info is available (confirmed) or times out.
 */
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
 * Posts JSON payload to a webhook (Make).
 * If URL is empty, does nothing.
 */
async function postJson(url, payload) {
  if (!url) return;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${text}`);
}

(async () => {
  const startedAt = new Date().toISOString();

  // Network / auth
  const FULLNODE = process.env.TRON_FULLNODE || "https://api.trongrid.io";
  const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || "";

  // Signing wallet + target contract
  const PRIVATE_KEY = must("TRON_PRIVATE_KEY");
  const BOOTSTRAPPER = must("BOOTSTRAPPER_ADDRESS");

  // Optional Make webhook
  const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "";

  // TronWeb expects private key without 0x prefix
  const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY.slice(2) : PRIVATE_KEY;

  const tronWeb = new TronWeb({
    fullHost: FULLNODE,
    privateKey: pk,
    headers: TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": TRONGRID_API_KEY } : {},
  });

  const from = tronWeb.address.fromPrivateKey(pk);
  const contract = await tronWeb.contract(BOOTSTRAPPER_ABI, BOOTSTRAPPER);

  // Fee limit in SUN (1 TRX = 1_000_000 SUN)
  const feeLimit = Number(process.env.FEE_LIMIT_SUN || 200_000_000);

  let txid = null;

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

    // Wait confirmation
    const info = await waitForTx(tronWeb, txid);
    const result = info?.receipt?.result || "UNKNOWN";
    console.log("RESULT:", result);

    const endedAt = new Date().toISOString();

    // Build Make payload (safe: no secrets included)
    const payload = {
      ok: result === "SUCCESS",
      result,
      txid,
      tronscan: `https://tronscan.org/#/transaction/${txid}`,
      from,
      bootstrapper: BOOTSTRAPPER,
      startedAt,
      endedAt,
      node: FULLNODE,
    };

    // Notify Make
    await postJson(MAKE_WEBHOOK_URL, payload);

    // Fail the job if tx failed
    if (result !== "SUCCESS") {
      throw new Error(`Transaction failed: ${txid}`);
    }
  } catch (err) {
    const endedAt = new Date().toISOString();

    // Send error payload to Make as well
    const payload = {
      ok: false,
      error: String(err?.message || err),
      txid,
      tronscan: txid ? `https://tronscan.org/#/transaction/${txid}` : null,
      from,
      bootstrapper: BOOTSTRAPPER,
      startedAt,
      endedAt,
      node: FULLNODE,
    };

    console.error("ERROR:", payload.error);

    try {
      await postJson(MAKE_WEBHOOK_URL, payload);
    } catch (e) {
      console.error("Make webhook error:", String(e?.message || e));
    }

    process.exit(1);
  }
})();
