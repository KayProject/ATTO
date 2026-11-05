# ATTO: Build Plan for Two Workers

**Spec** `docs/PRD.md` · **Architecture** `docs/ARCHITECTURE.md` · **Created** 2026-11-05
**Repo** https://github.com/KayProject/ATTO · commits as KayProject, no AI attribution
**Development ends** 2026-11-14 23:59 UTC (reference only)

> Two workers build ATTO at the same time without waiting on each other. A worker can be a
> person or an AI coding agent. This file says who owns what, in what order, how they stay in
> step, and how each piece is proven done.

---

## 1. How the work is split

The split follows one line: **what lives on the blockchain** and **what people see**.

| | Worker A: Chain | Worker B: Product |
|:--|:--|:--|
| Builds | Escrow contract, Keeper contract, all sandbox tests, threat model, "how control passes" doc | Title Search engine, event follower and history, Check API, ATTO bot, website, legal pages, README |
| Owns folders | `contracts/`, `tests/`, `docs/` | `services/`, `web/`, `README.md` |
| Language | Rust | TypeScript |
| Never edits | `services/`, `web/` | `contracts/`, `tests/` |
| Shared and frozen | `contracts/shared/`, `packages/shared/` | same |

Why this line works: the two sides only touch through the shared definitions (method names,
event formats, the report format and the fingerprint rule, `ARCHITECTURE.md` section 9). Once those are
written, Worker A can build contracts against them and Worker B can build everything else against
a pretend copy of the contracts (`packages/shared/mock`). When the real contracts are ready,
Worker B swaps the pretend copy for the real one and nothing else changes.

### Working rules

- **Branches.** Worker A works on `chain`, Worker B on `product`. Each merges into `main` only at
  a checkpoint, after the other worker has read the merge. `main` always runs.
- **The shared folders are frozen after S-04.** To change them, the worker who needs the change
  writes the request in `workbench/log/YYYY-MM-DD.md`, the other agrees there, and one commit
  updates both the Rust and TypeScript copies and the test vectors together.
- **A log entry for every decision, result and blocker**, as it happens, in
  `workbench/log/YYYY-MM-DD.md`. Blockers also go to Jadon in chat straight away.
- **Proof, not claims.** Every task lists how it is shown done: a passing test, a screenshot, or a
  command's output pasted in the log.
- **Commits are small** (one task or less) and the message is short.
- **Never without Jadon's yes:** deploying to mainnet, spending real NEAR, posting on X, sending
  the hackathon submission.

### Task format

`[ID] [Slice] What it is — where it goes` then a plain explanation and how it is shown done.
`[P]` means the task can run alongside the one before it. Slices: S1 buy clean (P1, the demo),
S2 keep it paid, S3 check before paying.

---

## Phase 0 · Together: set up and agree the line (both workers)

Both workers do this phase together. It is short, and nothing else starts before it ends.

- [ ] **S-01** Repo skeleton — repo root
  Create the folders from `ARCHITECTURE.md` section 5, a `.gitignore` with only `target/`,
  `node_modules/`, `.env*`, build output and `workbench/`, and add `.claude/` and agent notes to
  `.git/info/exclude`. Set the commit identity to KayProject for this repo.
  *Done when:* `git log` shows the first commit by KayProject and `workbench/` is ignored.

- [ ] **S-02** Rust workspace and TypeScript workspace — `contracts/Cargo.toml`, `package.json`
  A Rust workspace with empty `escrow`, `keeper` and `shared` crates that build with
  `cargo near build`, and a pnpm workspace with empty `packages/shared`, `services/*` and `web`.
  *Done when:* both build commands succeed on a clean clone.

- [ ] **S-03** Write the shared definitions — `contracts/shared/`, `packages/shared/`
  Everything in `ARCHITECTURE.md` section 9: the `Manifest` type, the fingerprint rule
  (`sha256` of the Borsh bytes; Borsh is a fixed binary layout so both languages produce the
  same bytes), method signatures, event shapes, the `Report` format, listing states, account
  names per network.
  *Done when:* three test vectors exist and both the Rust test and the TypeScript test produce the
  same three hashes.

- [ ] **S-04** Freeze — `workbench/log/`
  Both workers sign off in the log. From here the shared folders change only by the rule above.

- [ ] **S-05** Pretend contracts — `packages/shared/mock/`
  An in-memory escrow and Keeper in TypeScript that follow the same states, refuse the same
  wrong moves and emit the same events. Written by Worker B, reviewed by Worker A, because A knows
  how the real ones must behave.
  *Done when:* a script walks one listing from Listed to Completed and one to Reversed.

**Checkpoint 0** — skeleton builds, shared definitions frozen, mock works. The two lanes start.

---

## Phase 1 · Foundations (in parallel)

These answer the open questions in `PRD.md` section 13 before any feature is built on them.

### Worker A

- [ ] **A-01** Find the registry and Intents on each network — `workbench/log/`
  Find the account names of the TLA registry, `hos-extension` and NEAR Intents on testnet and
  mainnet (spec Q3). Read them with RPC calls; paste the output.
  *Done when:* the account table in `packages/shared` is filled with real names, or testnet is
  confirmed absent and logged as a blocker to Jadon.

- [ ] **A-02** Read the Intents source for keys and modes — `workbench/log/`
  In `github.com/near/intents`, find the exact methods to list an account's keys, remove a key,
  read balances (`mt_tokens_for_owner`) and read or change the "signed messages only" mode
  (spec Q1, threat T2). Note whether removing a key works by a direct call from the account.
  *Done when:* each method is logged with a link to the line in the source.

- [ ] **A-03** Prove a contract can drive a name — `tests/spike_contract_owner.rs`
  Using the registry's own sandbox fixtures (`integration/tests/common/mod.rs`, MIT/Apache, credit
  in the README), rent a name, send it to a tiny test contract, and have that contract make the
  name call Intents `add_public_key` then `remove_public_key` through `w_execute_extension`
  (spec Q2). This is the riskiest assumption in the plan, so it goes first.
  *Done when:* the test passes. If it fails, stop and raise it: `ARCHITECTURE.md` section 12 has the
  fallback.

- [ ] **A-04** [P] Check business endings and payout permission — `workbench/log/`
  Read `assert_transferable`, `open_nft_transfer` and `set_payout_account` in the registry:
  can a business ending send a name to the escrow (spec Q5), and may the owner change the payout
  account (needed by `complete`, threat T12)?
  *Done when:* both answers are logged with the lines that decide them.

- [ ] **A-05** Threat model document — `docs/THREAT-MODEL.md`
  `ARCHITECTURE.md` section 7 rewritten for a judge: each attack, what stops it, and the test that proves
  it. The track asks for this before any contract code, so it is written now and shown to Jadon.
  *Done when:* Jadon has said OK in chat. Contract code (A-06 on) starts after that.

### Worker B

- [ ] **B-01** Title Search, direct reads — `services/title-search/src/direct.ts`
  The sections that need only RPC calls: owner, lease, payout, wallet balances, the name's own
  access keys, and (once A-02 lands, from the log) Intents keys, balances and mode. Runs against
  mainnet, read only, which is safe.
  *Done when:* a report for three real mainnet names prints with these sections filled.

- [ ] **B-02** [P] Pick the indexer — `workbench/log/`
  Compare FastNEAR and NearBlocks on three names: which returns every program each name called
  and every account it created (spec Q4). Pick one and log why.
  *Done when:* the choice and the comparison are logged.

- [ ] **B-03** Title Search, history-based reads — `services/title-search/src/indexed.ts`
  NFTs and their approvals, DAO roles, sub-accounts, the date each Intents key was added.
  *Done when:* a mainnet name that has used an NFT program and a DAO shows both.

- [ ] **B-04** Ratings, manifest and fingerprint — `services/title-search/src/rate.ts`
  Rate every line (Clean, Will be cleared, Needs the seller, with what to ask the seller), build
  the `Manifest`, compute the fingerprint with the shared code.
  *Done when:* the fingerprint of a known manifest matches the S-03 test vector.

- [ ] **B-05** [P] Design foundations — `web/src/styles/`
  Following the standing instructions: type scale, spacing scale, colour tokens for light and dark,
  44px minimum targets, corner radius and elevation steps, motion durations and the
  reduced-motion rule, all from the HIG skill; visual identity from the taste tools. Fonts
  self-hosted with `next/font`.
  *Done when:* the token file exists and a sample page shows both themes; the network tab shows no
  request to Google Fonts.

**Checkpoint 1** — Jadon has approved the threat model. A contract can drive a name (A-03 green).
Title Search produces a full report for a real name. Both lanes merge to `main`.

---

## Phase 2 · Slice 1: buy a name clean (P1, the demo)

**Goal** A dirty name sold through the escrow ends with no leftovers, and the old key fails.

### Worker A

- [ ] **A-06** Escrow: listing, payment, refunds — `contracts/escrow/src/lib.rs`
  `list`, `delist`, `pay`, `cancel`, `reclaim_payment` and the views (`ARCHITECTURE.md` 6.1).
  *Done when:* tests for paying, cancelling and the 48-hour refund pass (acceptance 3).

- [ ] **A-07** Escrow: receiving the name — `contracts/escrow/src/receive.rs`
  `nft_on_transfer` with every check from threat T15: right caller, right seller, right token,
  paid listing. Anything else sends the name back.
  *Done when:* tests T14 and T15 and acceptance 4 pass.

- [ ] **A-08** Escrow: manifest and clearing — `contracts/escrow/src/clear.rs`
  `post_manifest` with the fingerprint rule and the buyer-only path for a changed report;
  `clear` in pages, making the name remove Intents keys and revoke NFT approvals.
  *Done when:* tests T1, T4 and T5 pass.

- [ ] **A-09** Escrow: verify, complete, reverse — `contracts/escrow/src/settle.rs`
  `verify` reads keys, balances, NFTs and extensions on the blockchain; `complete` repoints the
  payout and sends the name then the money; `reverse` returns both. Measure gas for `clear`
  pages here and set the page size.
  *Done when:* tests T3, T6, T10, T12, T13 and acceptance 1, 2 and 5 pass.

- [ ] **A-10** The full dirty-name test — `tests/clean_sale_dirty_name.rs`
  One test that builds the demo's exact situation: a seller-held Intents key with a balance behind
  it, an NFT approval, a sub-account. Runs the whole sale. Then tries to withdraw with the old key
  and shows it is refused. This is the track's "seller left keys in Intents" test.
  *Done when:* it passes, and its output is pasted in the log.

- [ ] **A-11** Deploy the escrow — `contracts/escrow/deploy.sh`
  Deploy to testnet (or the shared sandbox if A-01 found no testnet registry), then delete the
  account's full-access key (T16). Put the account name in `packages/shared`.
  *Done when:* an RPC call shows the escrow account with no access keys.

- [ ] **A-12** [P] How control passes — `docs/HOW-CONTROL-PASSES.md`
  For the README and the judges: what moves with the NFT, what the registry clears, what ATTO
  clears on top, what ATTO only reports, and why the wallet's NEAR goes to the seller.
  *Done when:* Worker B has read it and linked it from the README.

### Worker B

- [ ] **B-06** Event follower and history store — `services/follower/`
  Read new blocks, keep registry and escrow events, write the tables in `ARCHITECTURE.md` 8.2, backfill
  existing names.
  *Done when:* a transfer made in sandbox or testnet appears in the `events` table within one
  minute.

- [ ] **B-07** Bot: sale steps — `services/bot/src/sale.ts`
  On `name_received`: final report, `post_manifest`, `clear` pages, `verify`, then `complete`
  or `reverse`. Built against the mock first.
  *Done when:* the mock walk from S-05 is driven by the bot with no manual steps.

- [ ] **B-08** Pages: search and report — `web/src/app/(public)/`
  Search box, the report with ratings, what to ask the seller, and the line saying the wallet's
  NEAR goes to the seller.
  *Done when:* screenshots of a clean and a dirty report in both themes are in the log.

- [ ] **B-09** Pages: sell and buy — `web/src/app/sale/`
  The seller lists and hands over; the buyer accepts a report, pays, and watches the sale move
  through each state, with the cleared items listed at the end. Wallet connection here.
  *Done when:* a full sale runs on the mock through the website.

- [ ] **B-10** [P] History page — `web/src/app/names/[name]/history/`
  Every event for a name, including the sale with both reports.
  *Done when:* acceptance 7 is shown with a screenshot.

- [ ] **B-11** [P] Legal pages and consent banner — `web/src/app/legal/`
  Terms, privacy policy, cookie policy, consent banner, all linked in the footer, written with the
  content-writer skill. No analytics unless cookieless and without replay.
  *Done when:* each page loads from the footer.

### Joining the lanes

- [ ] **J-01** Swap the mock for the real escrow — `packages/shared/client.ts` (Worker B, Worker A reviews)
  Point the bot and website at the deployed escrow from A-11.
  *Done when:* a real sale of a dirty name completes on testnet or sandbox through the website,
  driven by the bot, with no manual RPC calls.

**Checkpoint 2 — P1 done.** The demo story runs end to end. **Record the demo now**, not at the
end. Merge both lanes to `main`.

---

## Phase 3 · Slice 2: keep the name paid (P2)

### Worker A

- [ ] **A-13** Keeper: reserve, top-up, withdraw, configure — `contracts/keeper/src/lib.rs`
  Per-name reserve; `configure` and `withdraw` only by the name itself; `top_up` by anyone.
  *Done when:* acceptance S2-6 passes.

- [ ] **A-14** Keeper: pull and sync — `contracts/keeper/src/pull.rs`
  `pull` makes the name send its share under the spend grant; `sync` credits the reserve from the
  wallet's own spent counter, only when the Keeper is the grant's single receiver, and handles a
  reset counter.
  *Done when:* tests for pulling within the cap, past the cap (refused, T18) and after a
  revoke-and-regrant pass (acceptance S2-4).

- [ ] **A-15** Keeper: renew and refunds — `contracts/keeper/src/renew.rs`
  `renew` inside the 30-day window only, re-reading the lease afterwards to know if it worked;
  `collect_refunds`.
  *Done when:* acceptance S2-2 and S2-3 pass, and a failed renewal leaves the reserve whole.

- [ ] **A-16** Sale in the middle of a renewal — `tests/sale_mid_renewal.rs`
  The track's "sale in the middle of a payout" test: a Clean Sale and a Keeper renewal in flight
  at once (T19, acceptance S2-5).
  *Done when:* the lease is extended, the reserve is right, and the buyer owns the name.

- [ ] **A-17** Deploy the Keeper — `contracts/keeper/deploy.sh`
  Same as A-11, including deleting the full-access key.

### Worker B

- [ ] **B-12** Owner page and sign-in gate — `web/src/app/owner/[name]/`
  NEP-413 signed message, server check against the registry owner, then the page from
  `PRD.md` 5.4.
  *Done when:* acceptance S2-1 is shown: a non-owner is refused, the owner gets in.

- [ ] **B-13** Switch Keeper on in one signature — `web/src/lib/keeper-setup.ts`
  Builds the single request from `ARCHITECTURE.md` 6.2 (add the Keeper as an extension, grant capped at
  one year's rent with the Keeper as the only receiver, configure the share).
  *Done when:* after signing, `hos_spend_grant(keeper)` on the name shows the expected cap.

- [ ] **B-14** Bot: pull, renew, warn — `services/bot/src/keeper.ts`
  Hourly pulls of the owner's share of new income, daily renewals from `due_soon`, weekly
  refund collection, short-reserve warnings for the owner page.
  *Done when:* a name on a short test lease renews from its reserve with nobody acting, shown in
  the history as `renewed_by_keeper`.

**Checkpoint 3** — S1 and S2 both work on their own. Merge.

---

## Phase 4 · Slice 3: check before paying (P3)

All Worker B. Worker A uses this time for Phase 5's contract review.

- [ ] **B-15** Check API — `web/src/app/api/v1/names/[name]/`
  `changed?days=N` and `history`, rate-limited, from the history store.
  *Done when:* acceptance S3-1 and S3-2 pass as API tests.

- [ ] **B-16** Pay demo page — `web/src/app/pay/`
  A payment form for a name that calls the Check API and shows the warning only when the name
  changed owner inside the window.
  *Done when:* a screenshot shows the warning for a recently re-rented name and none for a stable
  one.

- [ ] **B-17** [P] Check API docs — `web/src/app/developers/`
  One page for app builders: the two endpoints, an example request and answer.

**Checkpoint 4** — all three slices work. Merge.

---

## Phase 5 · Hardening (both)

- [ ] **A-18** Every threat has its test — `tests/`
  Walk `docs/THREAT-MODEL.md` line by line; each ID has a passing test or a written reason why it
  can't be tested.
- [ ] **A-19** [P] Review Worker B's contract calls — `services/bot`, `web/src/lib`
  Worker A reads every place Worker B calls a contract, for wrong deposits, gas or arguments.
- [ ] **B-18** [P] Review Worker A's docs as a reader — `docs/`
  Worker B reads the threat model and control document as someone new would and fixes anything
  unclear with Worker A.
- [ ] **B-19** UI finish pass — `web/`
  The anti-slop pass from the HIG skill, the design mandate's anti-pattern list, reduced motion,
  44px targets, both themes, network tab shows no third-party fonts.

---

## Phase 6 · Submission

- [ ] **S-06** README — `README.md` (Worker B writes, Worker A checks the technical parts)
  What ATTO is, how it works, the proof (tests, threat model, demo), how to run it, configuration,
  layout. Credits the registry fixtures. Written with the content-writer skill.
- [ ] **S-07** Demo video — the Slice 1 story, recorded at Checkpoint 2 and re-cut if anything
  changed: dirty name, report, pay, handover, clearing, the old key refused, history.
- [ ] **S-08** Final checks — no AI attribution in any commit, PR or text; every commit by
  KayProject; no secrets in the repo; every config setting the README lists is read by the code.
- [ ] **S-09** Jadon only: post the demo on X (tag `@NEARProtocol`, `#NEARHackathon`), and confirm
  the submission payload (name, team, tracks, payout account, repo, post link, description,
  consent). The submission is sent only after Jadon says yes to the printed payload.

---

## 2. Order at a glance

```
Phase 0  S-01 > S-02 > S-03 > S-04 > S-05                     (both)
                                       |
Phase 1  A: A-01, A-02 > A-03 > A-04 > A-05 (Jadon OK)        B: B-01 > B-02 > B-03 > B-04, B-05
                                       |
Phase 2  A: A-06 > A-07 > A-08 > A-09 > A-10 > A-11, A-12     B: B-06 > B-07 > B-08 > B-09, B-10, B-11
                              J-01 (needs A-11 and B-09)   >   Checkpoint 2: record the demo
Phase 3  A: A-13 > A-14 > A-15 > A-16 > A-17                  B: B-12 > B-13 > B-14 (needs A-17)
Phase 4  A: Phase 5 review                                     B: B-15 > B-16, B-17
Phase 5  A-18, A-19                                            B-18, B-19
Phase 6  S-06, S-07, S-08, then S-09 by Jadon
```

## 3. Where one worker waits on the other

Only four places, each kept short by the mock:

| Wait | Why | How short |
|:--|:--|:--|
| B-01 needs A-02's Intents method names | The report reads Intents | B builds every other section first |
| J-01 needs A-11 | The real escrow must exist | B has already run the whole flow on the mock |
| B-13 and B-14 need A-17 | The real Keeper must exist | B builds the owner page and bot on the mock first |
| A's contract code waits for Jadon's OK on A-05 | The track asks for the threat model first | B keeps building through it |

## 4. Blockers to raise now

- **Testnet registry unknown (A-01).** If the registry is not on testnet, the demo runs in sandbox
  or on mainnet, and mainnet needs Jadon's yes and real NEAR.
- **Threat model sign-off (A-05).** Contract code waits for Jadon's OK.
- **Hosting (ARCHITECTURE.md sections 4 and 10).** Website, services and database need a host before
  Checkpoint 2's demo can run anywhere but a laptop.
