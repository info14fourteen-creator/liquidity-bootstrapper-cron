# 4TEEN Liquidity Bootstrapper Automation

This repository contains the automation infrastructure responsible for executing the daily liquidity operation for the 4TEEN ecosystem.

The system interacts with the on-chain Liquidity Bootstrapper contract and triggers the execution when conditions are satisfied.

The automation is designed to remain transparent, predictable, and publicly auditable.

---

## Architecture

The liquidity system consists of two layers:

### On-chain layer
Smart contracts deployed on the TRON network enforce the rules of liquidity execution.

These rules include:

- execution can occur **only once per UTC day**
- execution requires a minimum controller balance
- all results are recorded on-chain

### Automation layer

This repository contains the automation that:

- checks the system state
- calls the bootstrap function
- waits for transaction confirmation
- publishes execution data

Automation is executed using **GitHub Actions**.

---

## Execution Logic

The script performs the following steps:

1. Connects to the TRON network via TronGrid.
2. Calls the `bootstrapAndExecute()` function on the Liquidity Bootstrapper contract.
3. Waits for transaction confirmation.
4. Retrieves execution data from the blockchain.
5. Sends execution results to the notification system.

---

## Example Output

Example execution payload:
{
“ok”: true,
“result”: “SUCCESS”,
“txid”: “transaction_hash”,
“tronscan”: “https://tronscan.org/#/transaction/…”,
“startedAt”: “…”,
“endedAt”: “…”
}
---

## Transparency

All executions can be verified using public explorers:

TRONSCAN  
https://tronscan.org

CoinMarketCap DEX  
https://dex.coinmarketcap.com

GeckoTerminal  
https://www.geckoterminal.com

---

## Security

Automation **does not bypass smart contract rules**.

Even if the automation script runs multiple times:

- the contract enforces the daily execution limit
- execution cannot occur if conditions are not satisfied

---

## Project

This automation is part of the **4TEEN liquidity infrastructure**.

More information:  
https://4teen.me

---

## License

MIT
