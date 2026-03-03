import TronWeb from "tronweb";
import "dotenv/config";

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BOOTSTRAPPER_ABI = [
  {
    inputs: [],
    name: "bootstrapAndExecute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function waitForTx(tronWeb, txid, { timeoutMs = 180000, pollMs = 4000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await tronWeb.trx.getTransactionInfo(txid);
    if (info && info.id) return info;
    await sleep(pollMs);
  }
  throw new Error(`Timeout waiting for tx: ${txid}`);
}

async function postJson(url, payload) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

(async () => {
  const startedAt = new Date().toISOString();

  const FULLNODE = process.env.TRON_FULLNODE || "https://api.trongrid.io";
  const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || "";

  const PRIVATE_KEY = must("TRON_PRIVATE_KEY");
  const BOOTSTRAPPER = must("BOOTSTRAPPER_ADDRESS");
  const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "";

  const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY.slice(2) : PRIVATE_KEY;

  const tronWeb = new TronWeb({
    fullHost: FULLNODE,
    privateKey: pk,
    headers: TRONGRID_API_KEY
      ? { "TRON-PRO-API-KEY": TRONGRID_API_KEY }
      : {},
  });

  const from = tronWeb.address.fromPrivateKey(pk);
  const contract = await tronWeb.contract(BOOTSTRAPPER_ABI, BOOTSTRAPPER);

  const feeLimit = Number(process.env.FEE_LIMIT_SUN || 200_000_000);

  let txid = null;
  let result = "UNKNOWN";
  let errorMessage = null;

  try {
    console.log("From:", from);
    console.log("Bootstrapper:", BOOTSTRAPPER);

    txid = await contract.bootstrapAndExecute().send({
      feeLimit,
      callValue: 0,
      shouldPollResponse: false,
    });

    console.log("TXID:", txid);

    const info = await waitForTx(tronWeb, txid);
    result = info?.receipt?.result || "UNKNOWN";

    console.log("RESULT:", result);

  } catch (err) {
    errorMessage = String(err?.message || err);
    console.error("ERROR:", errorMessage);
  }

  const endedAt = new Date().toISOString();

  const payload = {
    ok: result === "SUCCESS",
    result,
    error: errorMessage,
    txid,
    tronscan: txid
      ? `https://tronscan.org/#/transaction/${txid}`
      : null,
    from,
    bootstrapper: BOOTSTRAPPER,
    startedAt,
    endedAt,
    node: FULLNODE,
  };

  console.log("Final payload:", payload);

  await postJson(MAKE_WEBHOOK_URL, payload);

  // IMPORTANT:
  // Do NOT exit with code 1 for REVERT.
  // Only exit 1 if there was no txid at all.
  if (!txid) {
    process.exit(1);
  }
})();
