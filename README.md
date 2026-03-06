# 4TEEN Liquidity Automation

This repository contains the automation layer responsible for executing the daily liquidity operation for the 4TEEN ecosystem.

The automation interacts with the on-chain **Liquidity Bootstrapper** smart contract and triggers the liquidity execution when contract conditions are satisfied.

All execution rules are enforced directly by the smart contract.

---

## Architecture

The liquidity infrastructure consists of two independent layers.

### On-chain layer

Smart contracts deployed on the TRON network enforce the liquidity execution rules.

These rules include:

- execution can occur **only once per UTC day**
- execution requires a minimum controller balance
- all execution results are recorded permanently on-chain

Because these rules are enforced by the contract itself, the automation cannot bypass them.

---

### Automation layer

This repository contains the external automation responsible for:

- checking execution availability
- calling the `bootstrapAndExecute()` function
- waiting for transaction confirmation
- sending execution data to notification systems

Automation runs using **GitHub Actions**.

This allows the liquidity system to operate continuously without relying on manual interaction.

---

## Execution Flow

1. Connect to the TRON network using TronGrid.
2. Call the `bootstrapAndExecute()` function on the Liquidity Bootstrapper contract.
3. Wait for transaction confirmation.
4. Collect execution data.
5. Publish execution results.

---

## Transparency

Every execution is publicly verifiable.

Transaction data can be viewed using public blockchain explorers:

TRONSCAN  
https://tronscan.org

CoinMarketCap DEX  
https://dex.coinmarketcap.com

GeckoTerminal  
https://www.geckoterminal.com

---

## Manual Trigger

Although the system is automated, execution can also be triggered manually.

If the daily execution has not occurred and the contract conditions are satisfied, anyone can trigger the execution.

This ensures the system remains decentralized and operational even if automation is interrupted.

---

## Example Execution Payload
{
“ok”: true,
“result”: “SUCCESS”,
“txid”: “transaction_hash”,
“tronscan”: “https://tronscan.org/#/transaction/…”,
“startedAt”: “…”,
“endedAt”: “…”
}
---

## Project

Part of the **4TEEN liquidity infrastructure**.

Website  
https://4teen.me

---

## License

MIT
