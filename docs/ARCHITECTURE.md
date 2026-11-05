# ATTO: Technical Architecture

**Spec** `docs/PRD.md` · **Tasks** `docs/BUILD-PLAN.md` · **Created** 2026-11-05
**Source read** `houseofstake/tla-contracts` main branch, cloned 2026-11-05. Function names below
are quoted from that code. Anything not yet confirmed in code is marked `[VERIFY]` and has a task.

> How ATTO is built: the pieces, what each one does, how they talk, what data they keep, and
> every way a seller could try to keep access (the threat model, which the track asks for
> before any code). Plain words first, exact names second.

---

## 1. Constitution check

| Principle | How ATTO meets it |
|:--|:--|
| I. Ideas from research | The leftovers list came from reading the registry and wallet code, not from another product. Two of six leftovers (L5, L6) were found that way. |
| II. Novelty checked | `PRD.md` section 12. A wider search of NEAR entries is still open and marked. |
| III. Honest chain justification | Escrow and Keeper reserve hold money and a name for parties who don't trust each other: contracts. Title Search and history are off-chain and the spec says so. |
| VII. Demo-first | Slice 1 (buy clean) is a complete entry on its own. |
| VIII. Ambiguity visible | Five open questions in `PRD.md` section 13, each with an owner task. |
| X. Ship clean | Commits as KayProject. No AI attribution anywhere public. |

## 2. How the registry works, in the parts ATTO touches

You need this to follow the rest. Every name is its own account running a shared wallet program
(`hos-wallet`).

- **The owner is an "extension".** The wallet keeps a list of accounts allowed to give it
  instructions (`w_extensions`). The current owner is on it, and so is House of Stake's
  `hos-extension` account (the **authority**, which the registry uses for leases and reclaims).
  The owner gives an instruction by calling `w_execute_extension(request)` on the name, with a
  deposit of at least 1 yoctoNEAR (the smallest unit of NEAR, used as proof a wallet approved the
  call). The request can contain calls to other programs, which the name then makes in its own
  name.
- **Any account can be the owner, including a contract.** Nothing in the wallet checks whether the
  owner is a person. So ATTO's escrow can own a name and give it instructions. `[VERIFY]` in a
  test before anything is built on it (task A-03).
- **The name cannot call itself or hold keys.** The wallet refuses requests aimed at the name's own
  account (`SelfCallsNotAllowed`) and has signing turned off (`w_execute_signed` always fails). So
  nobody can sneak a key onto the name itself.
- **Spend grants.** The owner can give another extension a fenced permission
  (`hos_grant_spend`): a list of allowed receivers, a NEAR budget, token budgets, and an expiry.
  The grantee may only send plain NEAR transfers, `ft_transfer` or `nft_transfer`, only to the
  listed receivers, only within budget (`charge_spend`, `charge_token_call`). Keeper uses this.
  The wallet keeps a running total of what a grantee has spent (`spent_yocto`), readable by
  anyone through `hos_spend_grant(extension)`.
- **What happens on a change of owner** (`apply_rotation`): all spend grants are deleted; every
  extension except the authority is removed; the new owner is added; for a sale or transfer the
  payout account is pointed at the new owner; and the NEAR balance (minus a storage reserve) is
  sent to the **old** payout account (`sweep_to`). The registry also refuses the transfer if the
  name holds any token on its allowlist (`SubAccountHoldsTokens`).
- **Transfers.** `nft_transfer` and `nft_transfer_call` on the registry. The `_call` version then
  calls `nft_on_transfer` on the receiver, and if the receiver answers `true`, the registry sends
  the name back (`nft_resolve_transfer`). That is the standard NEP-171 hook ATTO's escrow uses.
- **A transfer into a "venue"** (an account House of Stake's council has listed) is treated as a
  deposit and keeps the payout with the seller. ATTO's escrow is not a venue, so a handover is an
  ordinary transfer. That is fine for ATTO and is why the wallet's NEAR goes to the seller.
- **Renewal.** `renew_sub_account(tla_id, name)` with the rent attached. Anyone can call it and
  pay. Overpayment is held as a refund the payer collects with `claim_refund()`. If renewal fails
  inside the registry, the registry records a refund and the call still looks successful from
  outside, so callers must re-read the lease to know.
- **Useful views.** `get_sub_account(tla_id, name)` gives owner, payout account, lease end and
  lifecycle. `get_rent_price(tla_id, name)` gives rent in yoctoNEAR. `list_recent_activity` gives
  recent events. On the name itself: `hos_lease()`, `nft_item_info()`, `w_extensions()`.

## 3. The pieces

```
                          people
      buyer / seller / owner / payer            app builders
                 |                                   |
                 v                                   v
       +--------------------+              +-------------------+
       |      Website        |------------>|    Check API       |
       |  search, report,    |             | "changed in N      |
       |  sale, owner page,  |             |  days?"            |
       |  history, pay demo  |             +---------+---------+
       +----+----------+----+                        |
            |          |                             |
            v          v                             v
  +----------------+  +------------------+   +-------------------+
  | Title Search   |  | Wallet (person's |   | History store      |
  | engine         |  | own, signs       |   | (database of       |
  | (reads chain + |  | transactions)    |   |  events per name)  |
  |  indexer)      |  +--------+---------+   +---------^---------+
  +-------+--------+           |                       |
          |                    v                       | events
          |        +-----------------------+   +-------+--------+
          |        |  ON THE BLOCKCHAIN     |   | Event follower  |
          |        |                       |   | (reads every    |
          +------->|  ATTO escrow contract |<--| new block)      |
          reads    |  ATTO keeper contract |   +----------------+
                   |  TLA registry          |
                   |  each name's wallet    |   +----------------+
                   |  NEAR Intents          |<--| ATTO bot        |
                   |  NFT programs, DAOs    |   | (presses due    |
                   +-----------------------+   |  buttons)       |
                                               +----------------+
```

| Piece | Lives | Job | Owner (see BUILD-PLAN.md) |
|:--|:--|:--|:--|
| Escrow contract | Blockchain | Holds payment and name, clears leftovers, checks, completes or reverses | Worker A |
| Keeper contract | Blockchain | Holds reserves per name, renews leases | Worker A |
| Shared definitions | Repo | Method names, event formats, report format, fingerprint rule, used by both sides | Both, frozen early |
| Title Search engine | Server | Builds the report for any name | Worker B |
| Event follower and history store | Server and database | Records every owner change, renewal, reclaim, sale | Worker B |
| Check API | Server | Answers "changed owner in N days?" | Worker B |
| ATTO bot | Server | Moves sales forward, pulls earnings shares, renews | Worker B (calls Worker A's contracts) |
| Website | Browser and server | Everything people see | Worker B |
| Tests and threat model | Repo | Proves every attack in section 7 fails | Worker A |

## 4. Stack

| Choice | Why |
|:--|:--|
| **Rust, `near-sdk` 5.x, `cargo-near`** for both contracts | The registry is written this way, so its types (`hos-common`) and test fixtures can be reused directly. |
| **`near-workspaces` sandbox tests** | Runs a private NEAR chain on the laptop. The registry's own integration tests already deploy the full registry, wallets and a NEAR Intents program in it (`integration/tests/common/mod.rs`, `intents_e2e.rs`). Licence is MIT or Apache-2.0, so ATTO can reuse them with credit. |
| **TypeScript on Node** for Title Search, follower, Check API and bot | One language for every off-chain piece and the website. `near-api-js` (or `@near-js/*`) for RPC calls. |
| **Next.js** for the website | Server routes host the Check API and Title Search; `next/font` self-hosts fonts (FR-051). |
| **Postgres** for history | Events per name, queried by name and date. Small tables. [NEEDS CLARIFICATION: hosting; SQLite is fine for the demo if hosting is undecided.] |
| **NEAR Connect / wallet selector** | Lets people sign with whatever NEAR wallet they use. |
| **Indexer** | [NEEDS CLARIFICATION: chosen in task B-02 between FastNEAR and NearBlocks APIs, on which returns every receiver a given account has called and every account it created.] |
| **RPC** | FastNEAR or the public NEAR RPC for reads; the bot uses its own funded account for writes. |

## 5. Repository layout

```
ATTO/
  contracts/
    Cargo.toml            Rust workspace for both contracts
    escrow/src/           escrow contract                   (Worker A)
    keeper/src/           keeper contract                   (Worker A)
    shared/src/           Rust copies of the shared types   (both, frozen)
  tests/                  sandbox tests, one file per threat (Worker A)
  packages/shared/        TypeScript copies of the shared types, fingerprint
                          code and test vectors              (both, frozen)
  services/
    title-search/         report builder                    (Worker B)
    follower/             event follower and history store  (Worker B)
    bot/                  ATTO bot                          (Worker B)
  web/                    website and API routes            (Worker B)
  docs/
    THREAT-MODEL.md       section 7 of this file, for judges (Worker A)
    HOW-CONTROL-PASSES.md what moves with the NFT            (Worker A)
  README.md               for someone running or using ATTO  (Worker B, A reviews)
  workbench/              gitignored: plans, logs, scripts, demo notes
```

`.git/info/exclude` holds `.claude/`, agent notes and any tool folders. The shared `.gitignore`
holds only `target/`, `node_modules/`, `.env*`, build output and `workbench/`.

## 6. The contracts in detail

### 6.1 Escrow

**Stored data**

```
Listing {
  id: u64
  token_id: String            e.g. "bakery.food"
  tla_id, label               "food", "bakery"
  seller: AccountId
  price: NEAR amount
  state: Listed | Paid | NameHeld | Clearing | Verified | Completed | Reversed | Cancelled
  buyer: Option<AccountId>
  accepted_fingerprint: Option<[u8; 32]>   the report the buyer accepted
  manifest: Option<Manifest>               what to clear and check
  paid_at, name_at: timestamps
  failure: Option<String>                  which item blocked a reversal
}

Manifest {                       defined once in contracts/shared and packages/shared
  intents_keys: Vec<PublicKey>   keys to remove
  intents_floor: Vec<(token_id, amount)>  Intents balances the buyer was shown
  nfts: Vec<(contract, token_id)>         NFTs whose approvals to revoke
  needs_seller: Vec<String>               plain-text items the buyer accepted as-is
}
fingerprint = sha256(borsh(Manifest))
```

**Methods** (who may call them in brackets)

| Method | Does |
|:--|:--|
| `list(token_id, price)` (seller) | Reads `get_sub_account`; requires caller is the owner and the lease ends after now plus the sale window (72 hours). Creates a listing. |
| `delist(id)` (seller) | Only before payment. |
| `pay(id, fingerprint)` (buyer, attaches exactly the price) | Records the buyer and the report they accepted. State becomes Paid. |
| `cancel(id)` (buyer) | Only while Paid. Full refund. |
| `reclaim_payment(id)` (buyer) | Only while Paid and 48 hours after `paid_at`. Full refund. |
| `nft_on_transfer(sender_id, previous_owner_id, token_id, msg)` (the registry only) | Called when the seller sends the name with `nft_transfer_call` and `msg = listing id`. Answers `false` (keep it) only if the caller is the registry, the listing is Paid, the sender is the listing's seller and the token matches. Anything else answers `true`, so the registry returns the name. State becomes NameHeld. |
| `post_manifest(id, manifest)` (anyone) | Accepted if `sha256(borsh(manifest))` equals the buyer's accepted fingerprint. If it differs (the seller changed something before the handover), only the buyer may post it, which counts as the buyer accepting the new report. State becomes Clearing. |
| `clear(id, from, count)` (anyone) | Makes the name call, in its own name: `remove_public_key` on NEAR Intents for each key, and `nft_revoke_all(token_id)` on each NFT program, a page at a time so no single call runs out of gas. Uses `w_execute_extension` on the name. |
| `verify(id)` (anyone) | Reads, on the blockchain: Intents keys for the name (must be none), Intents balances (must be at least `intents_floor`), each listed NFT (still held by the name, no approvals), the name's extensions (only the authority and the escrow). If all pass: state Verified. If not: records `failure`. |
| `complete(id)` (anyone) | Only when Verified. Points the name's payout at the buyer (`set_payout_account` on the registry `[VERIFY]` the owner may call it), sends the name to the buyer with `nft_transfer`, and in the callback pays the seller. If the transfer fails, nothing is paid and it can be retried. |
| `reverse(id)` (anyone, once `failure` is set, or after a clearing timeout) | Sends the name back to the seller and the payment back to the buyer. |
| views | `get_listing(id)`, `listings_for(account)`, `listing_for_token(token_id)` |

**Events** (NEP-297 log lines, standard `atto`, read by the follower): `listed`, `paid`,
`name_received`, `manifest_posted`, `cleared`, `verified`, `completed`, `reversed`,
`cancelled`.

**What makes it safe**

- No owner, no admin, no upgrade method. After deployment the account's full-access key is
  deleted, so nobody, including ATTO, can change or drain it.
- Money leaves only to the listing's buyer or seller. Names leave only to the listing's buyer
  or seller.
- The seller is locked out from step 4 onward because the escrow is the owner. Everything after
  that point is final.
- What the escrow clears it also checks on-chain. It does not trust the bot's word.

**Sale sequence**

```
seller        buyer        escrow               registry / name wallet        Intents / NFTs
  | list ------------------>|  get_sub_account -->|
  |             | pay ----->|                     |
  | nft_transfer_call(msg=id) ------------------->|  rotation: seller -> escrow
  |             |           |<-- nft_on_transfer -|  (NEAR swept to seller)
  |             |           |  returns false      |
  bot: post_manifest ------>|
  bot: clear --------------->|  w_execute_extension on name ------> remove_public_key
  |             |           |                     |  ------------> nft_revoke_all
  bot: verify -------------->|  views ------------------------------> keys? approvals?
  bot: complete ------------>|  set_payout_account, nft_transfer -->|  rotation: escrow -> buyer
  |<---------- price --------|  on success
```

### 6.2 Keeper

**Stored data**

```
Reserve per name {
  balance: NEAR amount
  enabled: bool
  share_bps: u16           e.g. 500 = 5%, used by the bot only
  puller: AccountId        who may run pull(), default the ATTO bot
  last_spent_seen: u128    last spent_yocto read from the name's grant
  owed_by_registry: u128   renewal overpayments not yet collected
}
```

**Methods**

| Method | Does |
|:--|:--|
| `configure(enabled, share_bps, puller)` (the name itself) | The caller must be the name's own account, which only its owner can make speak (through `w_execute_extension`). |
| `top_up(name)` (anyone, attaches NEAR) | Adds to the name's reserve. |
| `pull(name, amount)` (the name's puller) | Makes the name send `amount` NEAR to the Keeper under its spend grant, then calls `sync`. |
| `sync(name)` (anyone) | Reads `hos_spend_grant(keeper)` on the name. Credits the reserve with `spent_yocto - last_spent_seen`, but only if the grant's receivers are exactly the Keeper. Handles a reset meter (grant revoked and re-made) by starting from zero. This is how a plain transfer, which carries no note, is matched to the right name: the name's own wallet keeps the count. |
| `renew(name)` (anyone) | Reads the lease and the rent. Only inside 30 days of lease end and only if the reserve covers rent plus 0.5%. Calls `renew_sub_account` with that amount. In the callback re-reads the lease: if the end date moved, takes the amount from the reserve and books the 0.5% as owed by the registry; if not, leaves the reserve whole (the registry refunds the Keeper). |
| `collect_refunds()` (anyone) | Calls `claim_refund()` on the registry. Money lands in a shared refund pool that tops up reserves which were over-charged. |
| `withdraw(amount)` (the name itself) | Sends `amount` from the name's reserve back to the name. |
| views | `get_reserve(name)`, `due_soon(from, limit)` for the bot |

**How an owner switches on share-of-earnings** (the website builds one request the owner signs):
1. `w_execute_extension` on the name with `AddExtension { keeper }`.
2. `hos_grant_spend(extension = keeper, receivers = [keeper], budget_yocto = one year's rent,
   tokens = [], items = [], expires_at = lease end)`.
3. `configure(true, 500, bot)` on the Keeper, sent by the name.

**Why it is safe**: the wallet itself fences the grant (one receiver, capped budget, expiry); the
Keeper only ever sends reserve money to the registry's renewal or back to the name; a sale wipes
the grant automatically, and the reserve stays filed under the name for the buyer.

## 7. Threat model: every way a seller could try to keep access

The track asks for this before any code. Each line becomes a test in `tests/` named after its ID.

| ID | The seller tries to... | What stops it | Where | Test |
|:--|:--|:--|:--|:--|
| T1 | Keep a signing key in NEAR Intents and use it later | Escrow removes every key, then `verify` reads that none remain | `clear`, `verify` | seller key removed, later withdrawal refused |
| T2 | Turn Intents to "signed messages only" so keys can't be removed by direct call | Title Search shows it as Needs the seller; `verify` fails if keys remain, and the sale reverses | report, `verify` | `[VERIFY]` the Intents method name for this mode (A-02) |
| T3 | Use the Intents key in the gap between handover and clearing to drain the Intents balance | `clear` can be posted in the same block chain as the handover by the bot; `verify` checks balances are at least what the buyer was shown, and reverses if not | `verify` | drain during gap causes reversal |
| T4 | Keep an approval on an NFT the name holds | `nft_revoke_all` on every listed NFT, then `verify` checks approvals are empty | `clear`, `verify` | approval removed |
| T5 | Add new keys or approvals after the buyer read the report | After handover the seller is not the owner and can add nothing. The manifest posted after handover must match the buyer's fingerprint or be posted by the buyer | `post_manifest` | changed manifest needs the buyer |
| T6 | Move NFTs or Intents money out before handover | Same as T5: the final report differs, so the buyer must accept it or the sale reverses | `post_manifest`, `verify` | missing item causes reversal |
| T7 | Keep a sub-account like `shop.bakery.food` with their own key | Can't be removed by anyone but its key holder. Title Search lists it as Needs the seller | report | report lists sub-account |
| T8 | Keep a DAO role through the name | Can't be changed without the DAO's vote. Listed as Needs the seller | report | report lists role |
| T9 | Put an access key on the name itself | The wallet refuses self-calls and signing; Title Search also lists the name's access keys and expects none | registry design, report | key list empty |
| T10 | Keep an extension (helper) on the name | Registry removes all extensions except the authority on every change of owner; `verify` checks too | registry, `verify` | extensions after sale = authority + buyer |
| T11 | Keep a spend grant | Registry deletes all grants on change of owner | registry | grants empty after sale |
| T12 | Collect money paid to the name while it sits in escrow | `complete` points the payout at the buyer before the final transfer, so the final sweep goes to the buyer | `complete` | payment during escrow reaches buyer |
| T13 | Let the lease lapse during the sale | `list` refuses leases ending inside the sale window. If the registry reclaims anyway, `verify` sees the escrow is no longer owner and the buyer is refunded | `list`, `verify` | reclaim mid-sale refunds buyer |
| T14 | Take the buyer's money and never send the name | The seller never touches the money. Buyer reclaims after 48 hours | `reclaim_payment` | no-show refund |
| T15 | Send the name with another listing's id, or fake the registry's call | `nft_on_transfer` checks the caller is the registry, the sender is this listing's seller and the token matches | `nft_on_transfer` | wrong msg returns name |
| T16 | Have ATTO's builders take the funds | No admin, no upgrade, full-access key deleted after deploy | deploy script | contract account has no keys |
| T17 | Rely on House of Stake's 5-minute revert window | Only the registry's authority can revert, not the seller. Stated as a trust assumption in the README | README | none, documented |
| T18 | Over-pull earnings through Keeper | The wallet caps the grant at one year's rent and one receiver; the money stays in the name's reserve, withdrawable only by the name | wallet, Keeper | pull past cap refused |
| T19 | Sell during a renewal | Renewal and sale touch different state; the renewal extends the lease whoever owns the name | registry, Keeper | sale mid-renewal |

Out of scope, stated plainly: money the seller already took before listing, sub-accounts and DAO
roles (reported, not removed), and tokens or programs ATTO's indexer has never seen.

## 8. The off-chain side

### 8.1 Title Search engine (`services/title-search`)

Input: a name. Output: a `Report` (shape in `packages/shared/report.ts`) with sections, ratings,
the manifest, and its fingerprint.

| Section | How it is read |
|:--|:--|
| Owner, lease, payout | `get_sub_account`, and `hos_lease()` on the name |
| Wallet | RPC account balance; `ft_balance_of` on each token in `get_ft_allowlist` and any token the indexer saw |
| Intents balances | `mt_tokens_for_owner(name)` on the Intents program `[VERIFY]` (A-02) |
| Intents keys and mode | Intents public-key view for the name and its mode flag `[VERIFY]` (A-02). Each key's added date comes from the indexer and is compared to the date the current owner took over |
| NFTs and approvals | Indexer: every NFT program the name has used; then `nft_tokens_for_owner(name)` on each, reading `approved_account_ids` |
| DAO roles | Indexer: every Sputnik DAO the name has used; then `get_policy()`, looking for the name in role groups |
| Sub-accounts | Indexer: accounts created by the name; RPC access-key list on each |
| Name's own keys | RPC access-key list on the name (expected empty) |
| Keeper reserve | `get_reserve(name)` on the Keeper |
| History | History store |

Results are cached per name for 60 seconds. A report built after the handover is the final one.

### 8.2 Event follower and history store (`services/follower`)

Reads every new block from the indexer's block stream and keeps NEP-297 events from the
registry (`nft_transfer`, `nft_mint`, `nft_burn`, renewal, reclaim and re-rent events) and from
ATTO's escrow and Keeper. A one-time backfill walks `nft_tokens` and `list_recent_activity` so
names that existed before ATTO have a starting point.

```
names(token_id, tla_id, current_owner, lease_end, updated_at)
events(id, token_id, kind, from_owner, to_owner, block_height, block_time, tx_hash, details_json)
   kind: minted | transferred | sold_clean | renewed | renewed_by_keeper | reclaimed | re_rented
reports(fingerprint, token_id, built_at, report_json)
```

### 8.3 Check API (Next.js route)

`GET /api/v1/names/{name}/changed?days=7` returns
`{ "changed": true, "at": "2026-11-02T10:14:00Z", "kind": "re_rented", "previous_owner": "..." }`.
`GET /api/v1/names/{name}/history` returns the event list. No key needed; rate-limited per IP.

### 8.4 ATTO bot (`services/bot`)

A loop with its own funded NEAR account. Every action it takes is a public method anyone could
call, so it has no special powers.
- Sales: on `name_received`, build the final report, `post_manifest`, `clear` page by page,
  `verify`, then `complete` or `reverse`.
- Keeper: every hour, for each enabled name, read balance growth since the last pull, `pull` the
  owner's share, capped by the grant. Every day, `due_soon` then `renew`. Weekly
  `collect_refunds`.
- Warnings: reserves that won't cover the next renewal are flagged for the owner page.

### 8.5 Website (`web/`)

| Page | Who | What |
|:--|:--|:--|
| Search | anyone | type a name, get its Title Search |
| Report | anyone | the report, ratings, and what to ask the seller |
| Sell | seller | list a name, see what the buyer will see, hand over when paid |
| Buy | buyer | accept a report, pay, follow the sale to the end |
| Owner page | the owner only | Keeper on or off, reserve, share, top up, withdraw, latest report |
| History | anyone | the name's events |
| Pay demo | anyone | a payment form that calls the Check API and warns |
| Terms, privacy, cookies, consent banner | anyone | ship with the first deploy |

Owner-page gate: the visitor signs a NEP-413 message (a standard signed note that proves which
account they control). The server verifies the signature, then checks `get_sub_account(...).owner`
equals that account. A DAO or multisig owner can't sign NEP-413 messages, so it uses the
read-only page and acts through its own tools. [NEEDS CLARIFICATION: whether DAO owners matter
for the demo.]

Design: HIG foundations (type scale, spacing, colour tokens for both themes, 44px targets, motion
and reduced-motion policy) are written into `web/` before the first component, per the standing
instructions; identity through the taste tools. Fonts self-hosted with `next/font`.

## 9. Shared definitions: the line between the two workers

Everything the two workers must agree on lives in `contracts/shared` (Rust) and
`packages/shared` (TypeScript), written together on day one and then frozen. A change after that
needs both workers to agree in writing in `workbench/log/`.

1. `Manifest` and the fingerprint rule, with three test vectors (manifest bytes and expected hash)
   that both the Rust and TypeScript code must pass.
2. Escrow and Keeper method names, arguments and return shapes (section 6).
3. Event names and their JSON fields (section 6.1 events, Keeper: `configured`, `topped_up`,
   `pulled`, `renewed`, `withdrawn`).
4. The `Report` format and the three ratings.
5. Listing states and which method moves between them.
6. Account names: registry, Intents program, escrow, Keeper, bot, per network.

Until Worker A's contracts are deployed, Worker B codes against `packages/shared/mock`, an
in-memory copy of the escrow and Keeper that follows the same states and emits the same events.

## 10. Networks and deployment

- **Tests**: sandbox, with the registry, wallets and an Intents program deployed from source.
- **Demo**: testnet if the registry runs there `[VERIFY]` (A-01). If it does not, the demo runs in
  sandbox with a local explorer view, and a mainnet deployment is a decision for Jadon, because
  it spends real NEAR and the hackathon rules require the human to confirm any mainnet deploy.
- **Contracts**: deployed to plain `.near`/`.testnet` accounts (the registry refuses to send a
  name to another rented name). Full-access keys deleted after deploy.
- **Website and services**: [NEEDS CLARIFICATION: host. Any Node host with Postgres works.]

## 11. Development end date

2026-11-14 23:59 UTC, read in `workbench/near-hackathon-2026/HACKATHON.live.md`. Listed for
reference only. It does not change scope or order.

## 12. Risks

| Risk | Effect | Answer |
|:--|:--|:--|
| A contract can't drive the name's wallet in practice (gas, deposits) | Slice 1 has no clearing | A-03 proves it before anything else is built; fallback is the buyer's own wallet doing the clearing step as the new owner, with the escrow holding the money until the buyer confirms |
| Intents doesn't let an account remove keys by direct call | T1 can't be cleared | A-02 reads the source first. Fallback: the seller removes keys before handover, and `verify` refuses to finish until they are gone |
| Indexer misses programs the name used | Report incomplete | Two indexers compared (B-02); report states its sources and date |
| No registry on testnet | Demo in sandbox only | Sandbox demo is still a full demo; mainnet is Jadon's call |
| Gas per `clear` page | Large names need many pages | Pages sized in A-09 tests |

## 13. Deferred

Payment in tokens, fees, business endings, a browser extension for the payment warning, DAO
owners on the owner page.
