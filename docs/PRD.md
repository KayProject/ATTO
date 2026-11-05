# ATTO: Product Requirements (PRD)

**Event** NEAR HACKATHON, track "NFTs That Do Something" (`nfts`) · **Development ends** 2026-11-14 23:59 UTC (reference only, it does not shape scope) · **Created** 2026-11-05 · **Status** draft, awaiting Jadon's OK
**Repo** https://github.com/KayProject/ATTO (public, empty)
**Built from** `workbench/near-hackathon-2026/claude/ATTO-AND-QUIET-YES.md` Part 1, checked against the live registry source (`houseofstake/tla-contracts`, read 2026-11-05)
**Companion files** `ARCHITECTURE.md`  · `BUILD-PLAN.md` 

> This file says **what** ATTO does and **why**. It names no programming languages or tools.
> Those live in `ARCHITECTURE.md`. Every term is explained the first time it appears, and the
> glossary at the bottom repeats them.

---

## 1. ATTO in one paragraph

On NEAR you can rent a name such as `bakery.food`. That name is two things at once: an NFT
(a one-of-a-kind digital deed with exactly one owner) and a real account that can hold money,
receive payments and use other programs. Whoever owns the NFT controls the account. ATTO makes
owning one of these names safe. Before a name is sold, ATTO lists everything the name is still
connected to. During the sale, a neutral program cuts the seller's leftover access, and only
then hands the name to the buyer and the money to the seller. While someone owns a name, ATTO
renews it from a rent reserve so it is never lost to a forgotten renewal. Anyone about to pay a
name can ask ATTO whether it recently changed owner.

## 2. The pitch

Buying a house comes with a title search and an escrow: a check that nobody else still has a
claim on it, and a neutral holder that releases the money only once the check passes. NEAR names
are now accounts that hold money and act, and they change hands with neither. ATTO is that title
search and escrow for NEAR names. It has to be a contract because the escrow holds the buyer's
money and the name at the same time, and nobody should be trusted to hold both.

## 3. The problem

### 3.1 How control of a rented name works today

Facts below were read in the registry's own code on 2026-11-05.

- A rented name has no password or key of its own. Its **owner** is another account that gives
  it instructions. The name's wallet program carries them out.
- When the name changes owner (a sale, a gift, or a reclaim after the lease runs out), the
  registry does real cleanup **inside the name's own wallet**:
  - it removes every helper the old owner had allowed to act for the name;
  - it cancels every spending allowance the old owner set up there;
  - it sends the name's NEAR coins (minus a small amount kept for storage) to the **old**
    owner's payout account;
  - it refuses the transfer outright if the name still holds any of a short list of approved
    tokens, so the seller must move those out first;
  - it makes the new owner the only one in control.

### 3.2 What the registry cannot see

A name that is used connects itself to other programs, and those connections live **in those
programs**, not in the name's wallet. The registry never touches them. These are the leftovers:

| # | Leftover | Where it lives | What the old owner can do with it |
|:--|:--|:--|:--|
| L1 | Signing keys registered in NEAR Intents | The Intents program | Sign instructions that move whatever the name holds inside Intents |
| L2 | Balances parked in NEAR Intents | The Intents program | Nothing on their own, but with L1 they can take them |
| L3 | Approvals on NFTs the name holds | Each NFT's own program | Move those NFTs out of the name |
| L4 | Roles in DAOs | Each DAO's program | Act on a shared treasury through the name, or leave the buyer holding a seat they don't know about |
| L5 | Sub-accounts the name created | NEAR itself | Keep a look-alike account such as `shop.bakery.food` that customers may still pay |
| L6 | Intents set to "signed messages only" | The Intents program | Block anyone, including a new owner, from removing L1 keys by direct call |

L5 and L6 are not in the original brief. They came out of reading the registry and wallet code
and are explained in `ARCHITECTURE.md` section 7 (the threat model).

### 3.3 The two situations where people lose money

**Buying a name.** A buyer pays for `bakery.food`. The seller kept a signing key in Intents. A
week later the seller uses it to move the name's Intents balance out. The buyer paid for an
account the seller can still reach into.

**Missing a renewal.** A bakery runs on `bakery.food`. The owner misses the renewal, the grace
period (the short window for late renewal) ends, and the registry takes the name back and rents
it to someone else. Customers keep paying `bakery.food` and the money now reaches a stranger.
Nothing warns them.

### 3.4 Corrections to the original brief

The brief was written before the registry code was read. Three of its statements are wrong, and
this PRD replaces them:

1. **"Balances stay with the name during a sale."** Not for NEAR coins. Any change of owner
   sends the name's NEAR to the outgoing owner's payout account. So in a Clean Sale the buyer
   gets the name, what it holds inside Intents, the NFTs it holds, and tokens outside the
   registry's list. The NEAR in the wallet goes to the seller. The listing must say this
   plainly.
2. **"The rent reserve sits inside the name's wallet and fills itself with 5% of every payment."**
   Neither part works. A plain payment to a NEAR account runs no code, so nothing can skim it as
   it arrives. And a reserve inside the wallet would be swept to the seller at the first sale.
   The reserve therefore lives in ATTO's Keeper program, filed under the name, and is filled
   in two ways explained in section 5.3.
3. **"Cancel every token spending permission the name has given out."** NEAR's standard token
   format has no spending permissions to cancel. The only allowances that exist are the ones
   inside the name's wallet, and the registry already clears those. This line is dropped.

## 4. Who it is for

| Person | What they want | What they fear |
|:--|:--|:--|
| **Buyer** | A name with nothing attached they didn't pay for | The seller keeping a back door |
| **Seller** | To be paid in full, without being suspected of keeping a back door | The buyer walking away after the name moved |
| **Owner** | Never to lose a name that earns money | Forgetting a renewal date |
| **Payer** | To pay the person they think they are paying | A name that quietly changed hands |
| **App builder** (wallet, checkout, payment link) | One simple check to protect their users | Building and running their own history of every name |

## 5. The product

ATTO has three parts.

### 5.1 Title Search

You type a name. ATTO returns a plain report of everything the name owns, owes, or lets someone
else control.

| Section | What it shows |
|:--|:--|
| Owner | Current owner and the date they took over |
| Lease | End date, grace period end, the cost of the next renewal |
| Wallet | NEAR and tokens inside the name's wallet, and which of them will go to the seller in a sale |
| Intents balances | Everything the name holds inside NEAR Intents (L2) |
| Intents keys | Every signing key registered for the name, and whether it was added before the current owner took over (L1) |
| Intents mode | Whether the name can still be controlled by direct call or only by signed messages (L6) |
| NFTs and approvals | NFTs the name holds, and which other accounts may move each one (L3) |
| DAO roles | DAOs where the name holds a role, and what that role can do (L4) |
| Sub-accounts | Accounts the name created, and whether anyone else holds their keys (L5) |
| Keeper reserve | Rent set aside for the name in ATTO's Keeper |
| History | Every owner, renewal, reclaim and ATTO sale |

Every line gets one of three ratings:

- **Clean.** Nothing anyone else controls.
- **Will be cleared.** ATTO removes it during a Clean Sale (L1, L3).
- **Needs the seller.** Only the seller or a third party can fix it (L4, L5, L6, and approved
  tokens still in the wallet). The report says exactly what to ask the seller to do.

Title Search is free, open to anyone, reads only public information, and changes nothing.

### 5.2 Clean Sale

A sale where the buyer's money and the name both go to a neutral program, the **escrow**, first.
The escrow is a smart contract: a program on the blockchain whose rules are public and that
nobody can change or override. It can hold the money and the name, clear leftovers, and then
either complete the sale or reverse it. It has no instruction that sends either anywhere else.

The sale, step by step:

1. **The seller lists the name** with a price. ATTO attaches a Title Search to the listing.
2. **The buyer reads the Title Search and accepts it.** Accepting records exactly which report
   the buyer saw.
3. **The buyer pays into the escrow.** The seller does not receive it yet.
4. **The seller hands the name to the escrow.** The escrow refuses the name unless the payment is
   already in. From this moment the seller can change nothing about the name, because they no
   longer own it.
5. **ATTO runs a final Title Search.** Because the seller is now locked out, this report is
   final. If it shows anything new that needs the seller, the buyer is asked to accept it or
   cancel.
6. **The escrow clears the leftovers**, acting as the name's owner: it removes every Intents
   signing key and revokes every approval on the NFTs the name holds.
7. **The escrow checks its own work** on the blockchain: no Intents keys left, no approvals left
   on the listed NFTs.
8. **The sale completes.** The name goes to the buyer and the payment goes to the seller, in the
   same step.
9. **The sale is written into the name's public history**, with both reports and the list of
   what was cleared.

### 5.3 Keeper

**Job 1: the name pays its own rent.**

1. The owner switches Keeper on for the name.
2. The owner puts rent into the name's **reserve** in Keeper in either of two ways:
   - **a top-up**: send money to the reserve directly;
   - **a share of earnings**: the owner gives Keeper a capped permission to move money from the
     name to the reserve. ATTO's automatic service watches the name's balance and moves the
     chosen share (for example 5%) of new income. The permission is capped on the blockchain at
     one year's rent and can send money only to the reserve, so even a faulty service can't take
     more or send it anywhere else.
3. From 30 days before the lease ends, anyone can press "renew". ATTO's automatic service does
   it. Keeper pays the registry from the reserve and the name gets another year.
4. If the reserve is short, the owner page shows a warning with the amount missing and the date
   it is needed.
5. The reserve belongs to the name, not to a person. If the name is sold, the reserve goes with
   it to the buyer, and the listing shows it. The capped permission ends at the sale (the
   registry cancels all such permissions on a change of owner), so the buyer switches Keeper on
   again if they want it.
6. Only the name itself, which means its current owner, can withdraw from the reserve, and the
   money goes back into the name.

**Job 2: check before you pay.**

ATTO keeps a public history of every name: owners, renewals, reclaims, re-rentals and Clean Sales.
Any app can ask one question, "has this name changed owner in the last N days?", and get yes or
no with the date and the kind of change. The app can then warn its user: "`bakery.food` changed
owner 3 days ago. Are you sure?"

### 5.4 The owner's page

A page only the current owner can open. They prove it by signing a message with their wallet,
and ATTO checks the registry to confirm they own the name. It shows the lease end date, Keeper
status, the reserve and how full it is, the share being set aside, the latest Title Search, and
buttons to switch Keeper on or off, top up, change the share, or withdraw.

## 6. Slices

A **slice** is a piece that can be shown working on its own, from start to finish. P1 alone must
be a complete entry, and P1 is what the demo video shows.

### Slice 1: Buy a name clean (P1, the demo)

A seller with a dirty name (a leftover Intents key holding a balance, an NFT approval, a
sub-account) lists it. The buyer runs a Title Search and sees every item rated. The buyer pays,
the seller hands over the name, the escrow clears the key and the approval, checks its work, and
completes the sale. Afterwards the old key no longer works: an attempt to use it to withdraw the
Intents balance fails on screen. The name's history page shows the sale.

**Why P1:** it is the whole idea in one story, and it meets the track's core demand: when the NFT
moves, the old owner keeps nothing.
**Shown on its own by:** the demo script in `BUILD-PLAN.md` Phase 6.

**Acceptance**
1. **Given** a name with a seller-held Intents key, **when** a Clean Sale completes, **then** the
   Intents program lists no keys for the name, and a withdrawal signed with the old key is
   refused.
2. **Given** a name holding an NFT with an approval for the seller's other account, **when** a
   Clean Sale completes, **then** that approval is gone.
3. **Given** the buyer has paid, **when** the seller never hands over the name, **then** after
   48 hours the buyer can take the full payment back.
4. **Given** a name with no payment in escrow, **when** the seller sends it to the escrow,
   **then** the name goes back to the seller unchanged.
5. **Given** a leftover that can't be cleared, **when** the escrow checks its work, **then** the
   name returns to the seller and the money to the buyer, and both see which item blocked it.
6. **Given** a name with any lease, **when** the Title Search runs, **then** every row from section
   5.1 is filled or marked "none found", never left blank.
7. **Given** a completed sale, **when** anyone opens the name's history, **then** the sale, both
   reports and the cleared items are listed.

### Slice 2: Keep the name paid (P2)

The owner signs in to the owner page, switches Keeper on, tops up the reserve and sets a 5% share.
The automatic service moves a share of new income into the reserve. When renewal is due, the
service renews the name from the reserve.

**Why P2:** it solves the second way people lose money (a missed renewal) and supplies the track's
"page only the holder can open".
**Shown on its own by:** a name on a short test lease being renewed from its reserve with nobody
pressing anything.

**Acceptance**
1. **Given** someone who doesn't own the name, **when** they open its owner page, **then** they
   are refused.
2. **Given** a reserve that covers the rent and a lease inside the 30-day window, **when** anyone
   presses renew, **then** the lease moves forward one term and the reserve drops by the rent.
3. **Given** a lease outside the 30-day window, **when** anyone presses renew, **then** nothing
   happens and the reserve is untouched.
4. **Given** a share-of-earnings permission, **when** the service tries to move more than one
   year's rent in total, or to any account except the reserve, **then** the name's wallet refuses.
5. **Given** a name sold through Clean Sale **in the middle of a renewal**, **when** both finish,
   **then** the lease is extended, the reserve is correct, and the buyer owns the name.
6. **Given** a reserve, **when** anyone other than the name itself asks to withdraw, **then** it
   is refused.

### Slice 3: Check before you pay (P3)

A public check that any app can call, and a small "pay this name" demo page that warns when the
name changed owner recently.

**Why P3:** it protects the people paying a name, who never chose to trust anyone.
**Shown on its own by:** paying a name that was re-rented two days ago and seeing the warning.

**Acceptance**
1. **Given** a name that changed owner 3 days ago, **when** an app asks "changed in the last 7
   days?", **then** the answer is yes, with the date and the kind of change.
2. **Given** a name that has not changed owner in the window, **when** an app asks, **then** the
   answer is no and the payment page shows no warning.

## 7. Requirements

**Title Search**
- **FR-001** The system MUST produce a report for any rented name, covering every section in 5.1.
- **FR-002** The system MUST rate each line Clean, Will be cleared, or Needs the seller, and for
  Needs the seller MUST say what the seller has to do.
- **FR-003** The system MUST mark which Intents keys were added before the current owner took over.
- **FR-004** The report MUST show that the wallet's NEAR will go to the seller in a sale.
- **FR-005** The report MUST carry a fingerprint (a short code computed from its contents) so the
  escrow can record exactly which report the buyer accepted.

**Clean Sale**
- **FR-010** The escrow MUST accept a name only when a matching paid listing exists, and otherwise
  hand it straight back.
- **FR-011** The escrow MUST remove every Intents signing key for the name and revoke every
  approval on the NFTs listed in the accepted report before completing.
- **FR-012** The escrow MUST check on the blockchain that no Intents keys and no approvals on the
  listed NFTs remain before completing.
- **FR-013** Completion MUST move the name to the buyer and the payment to the seller together,
  or neither.
- **FR-014** The buyer MUST be able to cancel and be refunded before the name arrives, and MUST be
  able to reclaim payment 48 hours after paying if the name never arrives.
- **FR-015** The escrow MUST refuse to start a sale if the lease would end within the sale window.
- **FR-016** If a check fails, the escrow MUST return the name to the seller and the money to the
  buyer.
- **FR-017** The escrow MUST have no way to send money or a name anywhere except buyer, seller, or
  back to where it came from. ATTO's builders MUST have no special powers over it.
- **FR-018** Clean Sale MUST support names under standard endings. Names under business endings
  (endings whose owner restricts resale) MUST be shown as not supported, with the reason.
  [NEEDS CLARIFICATION: whether business endings can whitelist the escrow; checked in the first
  build task]

**Keeper**
- **FR-020** Keeper MUST hold a separate reserve for each name.
- **FR-021** Only the name itself MUST be able to withdraw its reserve or change its settings, and
  withdrawals MUST go back into the name.
- **FR-022** Renewal MUST be callable by anyone, MUST pay only the registry, and MUST only run
  within 30 days of the lease end.
- **FR-023** The share-of-earnings permission MUST be capped at one year's rent and limited to the
  reserve as the only destination.
- **FR-024** The owner page MUST warn when the reserve will not cover the next renewal.

**History and check**
- **FR-030** The system MUST record every change of owner, renewal, reclaim, re-rental and Clean
  Sale for every name.
- **FR-031** The system MUST answer "changed owner in the last N days?" for any name.
- **FR-032** Each name MUST have a public history page.

**Owner page**
- **FR-040** The owner page MUST open only for the account that owns the name right now.

**Website and compliance**
- **FR-050** The website MUST ship with terms, privacy policy, cookie policy and a consent banner,
  linked in the footer.
- **FR-051** Fonts MUST be served from ATTO's own domain. No requests to Google Fonts at runtime.
- **FR-052** Analytics, if any, MUST be cookieless and without session replay.
- **FR-053** There is no sign-up (people connect a wallet), so no age screen is needed. If a
  sign-up is ever added, the standing age-check rule applies.

## 8. What ATTO works with

- **Name**: a rented account like `bakery.food`. Has an owner, a lease end, a payout account,
  and a wallet.
- **Leftover**: anything in section 3.2's table, attached to one name, with a rating.
- **Title Search report**: a dated snapshot of one name's leftovers, with a fingerprint.
- **Listing**: one name, one seller, one price, one accepted report, one state (listed, paid,
  name received, clearing, completed, reversed, cancelled).
- **Reserve**: an amount held for one name in Keeper, with its settings (on or off, share).
- **History entry**: one dated event for one name (owner change, renewal, reclaim, re-rent,
  Clean Sale).

## 9. How we know it works

- A Clean Sale of a name with every clearable leftover (L1 and L3) ends with zero leftovers of
  those kinds, checked by a test and shown in the video.
- Every case in `ARCHITECTURE.md` section 7 (the threat model) has a test that tries the attack and fails.
- The transfer tests include a sale in the middle of a renewal and a sale where the seller left
  keys in Intents, as the track asks.
- A Title Search on any mainnet rented name completes and fills every section.
- A name on a short test lease renews from its reserve with no person acting.

## 10. Not in this version

- Paying in tokens other than NEAR. The escrow takes NEAR only. Tokens come later.
- Fees. ATTO charges nothing.
- Removing DAO roles or sub-accounts for the seller. ATTO reports them; only the seller or the
  DAO can act on them.
- Clearing anything not in section 3.2.

## 11. Why this needs a blockchain, honestly

- **The escrow must be a contract.** It holds the buyer's money and the name at once, and acts as
  the name's owner while it clears leftovers. A company doing that could take either. A contract
  with public rules and no admin can't.
- **The Keeper reserve must be a contract.** It holds money for a name whose owner can change,
  and must pay only the registry. A database can't make that promise to a future buyer.
- **The weak part, stated plainly:** Title Search and the history are off the blockchain. They only
  read public data, and anyone could rebuild them, but users trust ATTO's service to have looked
  everywhere. The escrow narrows this: what it clears and checks, it checks on the blockchain
  itself. What it can only report (DAO roles, sub-accounts), it reports.

## 12. Closest existing work

- **The registry's own Intents marketplace.** Its tests show a name sold for tokens through NEAR
  Intents in one atomic swap. It moves the name and the money safely, but it does not look for or
  clear leftovers in Intents or elsewhere. ATTO adds that, and could later run on top of it.
- **Name systems on other chains** (for example ENS on Ethereum). There a name is a label pointing
  at an address and holds nothing, so there is nothing to clean. The problem only exists where a
  name is an account.
- [NEEDS CLARIFICATION: no wider search of hackathon entries for name escrow on NEAR has been
  done for this version. Run one before submission.]

## 13. Open questions

| # | Question | How it gets answered | Blocks |
|:--|:--|:--|:--|
| Q1 | The exact Intents commands to list keys, remove a key, and read the "signed messages only" mode | First task for Worker A, read in the `near/intents` source | Slice 1 |
| Q2 | Can a contract own a name and give it instructions? | Code says yes: the owner is just an account that calls the wallet. Worker A proves it in a test first | Slice 1 |
| Q3 | Is the registry deployed on testnet, and under which account? | Worker A, first day | Where the demo runs |
| Q4 | Which indexer lists every program a name has used | Worker B compares two in the first task | Title Search completeness |
| Q5 | Can business endings allow the escrow to receive names? | Worker A reads the business resale rules | FR-018 |

## Glossary

| Term | Meaning |
|:--|:--|
| Account | A named place on NEAR that holds money and acts, like `alice.near` |
| Approval | A permission stored in an NFT's program saying another account may move that NFT |
| DAO | A group that controls shared money through a smart contract |
| Escrow | A neutral holder that keeps money and a name until both sides of a deal are done |
| Fingerprint | A short code computed from a document's contents; any change gives a different code |
| Grace period | Extra time after a lease ends during which it can still be renewed |
| Indexer | A service that keeps a searchable copy of everything that happened on NEAR |
| Lease | The rental period of a name, with an end date |
| NEAR Intents | NEAR's program for swaps and payments across many blockchains; accounts can hold balances in it and register signing keys with it |
| NFT | A one-of-a-kind digital item with exactly one owner at a time |
| Owner | The account allowed to give a rented name instructions |
| Payout account | Where a name's NEAR goes when it changes owner or is reclaimed |
| Reclaim | The registry taking a name back after its lease and grace period end |
| Registry | The program that records who rents which name and until when |
| Reserve | Money Keeper holds for one name to pay its rent |
| Signing key | A secret that lets whoever holds it approve actions for an account |
| Smart contract | A program on the blockchain that runs by fixed public rules |
| Sub-account | An account created under another, like `shop.bakery.food` under `bakery.food` |
