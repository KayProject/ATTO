# ATTO

ATTO is a title search and escrow for rented NEAR names.

A name like `bakery.food` is an NFT and a working account at the same time. When the NFT changes hands, the registry cleans up the name's own wallet, but it can't see what the name is connected to in other contracts. The old owner can keep a signing key in NEAR Intents and use it to move whatever the name holds there. They can also keep approvals on NFTs the name owns.

ATTO finds those leftovers and removes them before anyone gets paid:

- Title Search reads a name and lists everything it owns, owes or lets someone else control. It rates every line as Clean, Will be cleared or Needs the seller.
- Clean Sale is an escrow contract. The buyer pays into it, the seller hands the name to it, and it removes every Intents key and NFT approval while it holds the name. It then checks its own work on chain, and only after that sends the name to the buyer and the money to the seller. If the check fails, both sides get back what they put in.
- Keeper renews a name from a reserve that belongs to the name, so a forgotten renewal doesn't lose it.
- Check API answers one question for any app about to pay a name: has it changed owner in the last N days?

## Try it

### On the live site

https://atto.namite.xyz reads NEAR mainnet. No wallet is needed for these steps.

1. Open [/search](https://atto.namite.xyz/search) and enter `near.pay`. You see the name's report: owner and payout, lease, wallet balances, Intents balances and keys, NFT approvals, DAO roles and sub-accounts, each line rated Clean, Will be cleared or Needs the seller. A modal notes that live reports are read-only.
2. Open [/pay](https://atto.namite.xyz/pay), enter `near.pay` and press Check this name. A modal answers whether the name changed owner in the last seven days.
3. Request `https://atto.namite.xyz/api/v1/names/near.pay/changed?days=30`. The answer is JSON: `{"changed":false}`, or `true` with the date, the kind of change and the previous owner. `/api/v1/names/near.pay/history` returns the name's ownership events.
4. Open [/owner/attotestowner.attotest.testnet](https://atto.namite.xyz/owner/attotestowner.attotest.testnet). Without the wallet that owns that testnet name you get the Owners only page. Connecting the owning testnet wallet opens its Keeper reserve, share and renewal controls.

### A full Clean Sale on the real contracts

This runs the House of Stake registry and the NEAR Intents contract on a local sandbox chain, with a name that still carries a seller-held Intents key, an NFT approval and a sub-account.

1. Run `tests/setup.sh`, then `cd tests && cargo test --test deploy_sandbox -- --ignored --nocapture` and leave it running.
2. From the repository root, run `NEXT_PUBLIC_ATTO_BACKEND=sandbox pnpm --filter web dev` and open http://localhost:3000/sale/new/bakery.tla.test.near. Demo controls, at the bottom left, set the acting account; start as Seller.
3. Enter a price of 5 and press List this name. A Review & Send window shows the 0.05 NEAR listing deposit going to the escrow. Press Transfer. You land on the sale page.
4. Switch to Buyer, tick the report box and press Pay 5 NEAR into escrow, then Transfer. A modal confirms the payment is held in escrow.
5. Switch to Seller and press Hand over, then Transfer. The escrow removes the Intents key and the NFT approval, checks on chain that both are gone, and completes the sale: the buyer gets the name and the seller gets 5 NEAR in the same transaction.
6. Press Try the old key. The withdrawal the seller signed before the sale is sent to NEAR Intents and refused, and a modal shows the name's Intents balance is unchanged.
7. Press See history. The sale is listed with the key that was removed and the approval that was revoked.

### The tests

After `tests/setup.sh`, `cd tests && cargo test` runs the sandbox tests in Proof, and `pnpm -r test` runs the TypeScript tests.

## Proof

The contracts run against the real registry, wallet and Intents code, deployed to a local NEAR sandbox.

- `tests/clean_sale_dirty_name.rs` sells a name that still has a seller-held Intents key, a token balance in Intents, an NFT approval and a sub-account. Before the sale, a withdrawal signed with the seller's key is valid. After the sale, the keys and approvals are gone, the balance is still in the name, and that same signed withdrawal is refused.
- `tests/sale_mid_renewal.rs` runs a Clean Sale and a Keeper renewal at the same time. The lease is extended, the buyer owns the name, and the reserve is charged exactly the rent the registry took.

The same escrow binary is deployed on NEAR mainnet at `escrow.jadonamite.near` and on NEAR testnet at `escrow.attotest.testnet`. On testnet a name with a leftover Intents key was sold through the website's own code: [listed](https://testnet.nearblocks.io/txns/6LKJBvtMMAYMCtrpq7kKHXCdcasuEeP8Cekjzgse6W75), [paid](https://testnet.nearblocks.io/txns/21L6rbdnLAUeWAp1jUUu1kZLuFDjnr47koeJupNA5UwA), [handed over](https://testnet.nearblocks.io/txns/9XGpRFmipNKbg526wVAkAeQ4kqrW4z3nThbtAHrWX8j), [cleared](https://testnet.nearblocks.io/txns/BuYB6TLduYpX2cvNyncHJ2rt3J8nGgFa1MDygXrgwsmD), [verified](https://testnet.nearblocks.io/txns/8B3EVEGPxPpK4PeSgwUcVSV2gKVPw3FRnGGBC39YHEND) and [completed](https://testnet.nearblocks.io/txns/9bFxAE9A43m2Sf7ur8ktYts3fyJSMvk9ZbLHdwHnXLmL).

The [threat model](docs/THREAT-MODEL.md) lists 30 ways a sale can go wrong and how the escrow handles each one. [How control passes](docs/HOW-CONTROL-PASSES.md) walks through the handover step by step.

## Run it

You need Node 24 and pnpm 10.

```sh
pnpm install
pnpm --filter web dev
```

This starts the website on demo data, which runs in memory and touches no network. The bar at the top switches between seller, buyer, owner and stranger, and can skip time forward to show the 48-hour refund and the renewal window.

### On the real contracts

The registry and Intents only run on mainnet, so the contracts run on a local sandbox chain. The setup script builds the registry from source and downloads the Intents contract and the sandbox binary:

```sh
tests/setup.sh
cd tests && cargo test --test deploy_sandbox -- --ignored --nocapture
```

Leave that running. It deploys the escrow and Keeper with no access keys, sets up a name with leftovers to clear, and writes the runtime details to `workbench/sandbox/`. Then, in a second terminal from the repository root:

```sh
NEXT_PUBLIC_ATTO_BACKEND=sandbox pnpm --filter web dev
```

The site now reads and signs real transactions on the sandbox with throwaway keys. The seller persona is whichever sandbox account owns the name, and the buyer is the other one. Keeper controls stay on demo data in this mode.

### On NEAR testnet or mainnet

```sh
NEXT_PUBLIC_ATTO_BACKEND=testnet pnpm --filter web dev
```

The site reads the deployed escrow and registry, and every transaction is approved in your own wallet: connect one from the bar at the top. No key is held by the site. After the seller hands the name over, the same wallet approves the remaining steps (post the final report, clear, verify, complete), one approval each. `mainnet` works the same way against `escrow.jadonamite.near` and `registry.hos`.

Testnet runs ATTO's own copy of the registry and Intents under `attotest.testnet`, with the escrow at `escrow.attotest.testnet` and the Keeper at `keeper.attotest.testnet`. Testnet has no transaction index, so the NFT, DAO role, sub-account and history sections of a report read as unavailable there. Name history is read from the chain on each request: the registry's events plus the escrow's sales. The owner page sets up, tops up, withdraws from and switches Keeper through the owner's wallet. Keeper is deployed on testnet only, so the owner page is closed on mainnet.

### Services

Title Search on a mainnet name, from finalized chain state:

```sh
pnpm --filter @atto/title-search exec tsx src/cli.ts near.pay
```

The history follower reads finalized blocks and saves registry and ATTO events to SQLite. `--backfill` starts it from a fresh registry baseline:

```sh
pnpm --filter @atto/follower exec tsx src/cli.ts --backfill
```

The bot drives held sales to completion and runs Keeper on the sandbox: it moves the owner's chosen share of new income into the reserve, renews names inside the 30-day window and collects registry refunds. Pass `--once` for a single pass, and don't run it while you're driving a sale from the website.

```sh
pnpm --filter @atto/bot exec tsx src/cli.ts
```

## Check API

```text
GET /api/v1/names/{name}/changed?days=7
GET /api/v1/names/{name}/history
```

`changed` answers `true` with the date, the kind of change and the previous owner, or `false` when nothing changed in the window. Renewals don't count as a change of owner. Every response carries an `x-atto-data` header naming its source. The `/developers` page has examples.

## Configuration

| Variable | What it sets |
| --- | --- |
| `NEXT_PUBLIC_ATTO_BACKEND` | `sandbox` runs the website on the local contracts. `mainnet` reads the deployed escrow on NEAR mainnet and sends every transaction to the visitor's own wallet. `testnet` does the same against ATTO's contracts on NEAR testnet, with a testnet wallet. Anything else uses the demo data. |
| `NEXT_PUBLIC_ATTO_LIVE_REPORTS` | `1` gives names outside the demo data a live, read-only report from NEAR mainnet. Sales stay on demo data. Off by default, and ignored in sandbox mode. |
| `ATTO_SANDBOX_RUNTIME` | Path to the sandbox `runtime.json`. Defaults to `workbench/sandbox/runtime.json`. |
| `ATTO_DB_PATH` | SQLite file for history and saved reports. Defaults to `workbench/atto.sqlite`. |
| `ATTO_NETWORK` | `mainnet` (default), `testnet` or `sandbox`, for the services. |
| `ATTO_RPC` | JSON-RPC URL. Mainnet defaults to FastNEAR. |
| `ATTO_REGISTRY`, `ATTO_HOS_EXTENSION`, `ATTO_INTENTS` | Contract accounts. Mainnet defaults are `registry.hos`, `ext.hos` and `intents.near`. |
| `ATTO_ESCROW`, `ATTO_KEEPER` | Deployed escrow and Keeper accounts. |
| `ATTO_FOLLOWER_FROM_HEIGHT` | Block height the follower starts from on its first run. |
| `ATTO_BOT_NAMES` | Comma-separated names the bot watches for Keeper. Defaults to the sandbox name. |
| `FASTNEAR_API_KEY` | Optional key for FastNEAR requests. |

Keep keys and runtime files out of git. Everything under `workbench/` is ignored.

## Layout

| Folder | What's in it |
| --- | --- |
| `contracts/` | Escrow, Keeper, the per-name collector Keeper funds reserves through, and the shared Rust definitions |
| `tests/` | Sandbox tests and the deploy script for the local demo |
| `packages/shared/` | Report, manifest and event definitions shared by the contracts and the website |
| `services/title-search/` | The report engine: registry, wallet and Intents reads, plus FastNEAR history |
| `services/follower/` | Ownership history in SQLite |
| `services/bot/` | The sale driver and Keeper scheduler |
| `web/` | The website and the Check API |
| `docs/` | Requirements, architecture, threat model and the handover walkthrough |

## What a report covers

Title Search reads finalized chain state at the moment it runs. ATTO removes Intents keys and NFT approvals, because the escrow can do that as the name's owner. Sub-accounts and DAO roles live in their own contracts, so the report lists them and tells the buyer exactly what to ask the seller for. The escrow pays in NEAR only and charges no fee.

The website serves its own fonts and runs no analytics. Terms, privacy and cookie policies ship with it and are linked in the footer.

## Built with

- The Top Level Accounts registry and extension from [houseofstake/tla-contracts](https://github.com/houseofstake/tla-contracts), built from source by `tests/setup.sh`.
- [NEAR Intents](https://github.com/near/intents): the sandbox runs the code deployed at `intents.near`, and the contracts use the `defuse-core` and `defuse-wallet` crates.
- `near-sdk` 5.29, `near-workspaces` 0.22 and `near-sandbox` for the contracts and tests.
- `near-api-js` for chain reads and transactions, `@hot-labs/near-connect` for wallet connection, and the FastNEAR RPC and API.
- Next.js, React, Radix UI, GSAP, Three.js with React Three Fiber, Tailwind CSS, zod, `@noble/hashes`, `@noble/curves` and Phosphor icons on the website. Fonts are DM Sans, Outfit, Inter and JetBrains Mono, served from Fontsource packages.

## NEAR HACKATHON

Built by Team ATTO for NEAR HACKATHON, November 2026, in the NFTs That Do Something (`nfts`) and AI Security & Defense (`security`) tracks. All code in this repository was written during the hackathon; the first commit is from 5 November 2026.

## License

MIT. See [LICENSE](LICENSE).
