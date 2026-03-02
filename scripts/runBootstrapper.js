import TronWeb from "tronweb";
import "dotenv/config";

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const BOOTSTRAPPER_ABI = [
  {
    "inputs": [],
    "name": "bootstrapAndExecute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
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

(async () => {

  const FULLNODE = process.env.TRON_FULLNODE || "https://api.trongrid.io";
  const PRIVATE_KEY = must("TRON_PRIVATE_KEY");
  const BOOTSTRAPPER = must("BOOTSTRAPPER_ADDRESS");

  const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY.slice(2) : PRIVATE_KEY;

  const tronWeb = new TronWeb({
    fullHost: FULLNODE,
    privateKey: pk,
    headers: process.env.TRONGRID_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
      : {}
  });

  const from = tronWeb.address.fromPrivateKey(pk);

  console.log("From:", from);
  console.log("Bootstrapper:", BOOTSTRAPPER);

  const contract = await tronWeb.contract(BOOTSTRAPPER_ABI, BOOTSTRAPPER);

  const feeLimit = 200_000_000; // 200 TRX

  try {

    const txid = await contract
      .bootstrapAndExecute()
      .send({
        feeLimit,
        callValue: 0,
        shouldPollResponse: false
      });

    console.log("TXID:", txid);

    const info = await waitForTx(tronWeb, txid);

    const result = info?.receipt?.result || "UNKNOWN";

    console.log("RESULT:", result);

    if (result !== "SUCCESS") {
      throw new Error(`Transaction failed: ${txid}`);
    }

  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }

})();
