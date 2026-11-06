# How control passes in an ATTO sale

A rented NEAR name is both a registry NFT and an account. Moving its NFT changes who can instruct
its wallet. It does not erase the account's history or every permission stored by other contracts.

## The first handover

The seller sends the registry NFT to ATTO with `nft_transfer_call`. The registry rotates the
wallet before calling ATTO's receiver method. ATTO accepts only a paid listing for that token,
from that listing's seller, delivered by the configured registry.

During rotation, the registry removes the seller's extensions and spending grants. It installs
the escrow as the wallet's new owner, alongside the registry authority. The wallet has no access
keys and does not permit signed wallet requests. The outgoing payout account receives the name's
spare NEAR, and the report tells the buyer so before they pay.

These rules come from `houseofstake/tla-contracts` at `d85860a8cc2bfcb8b617b28cab558da5d39333fc`:
`contracts/tla-registry/src/nft.rs`, `marketplace.rs` and `rental.rs`, and
`contracts/hos-wallet/src/lib.rs` (`apply_rotation`, `execute_request`, `hos_grant_spend`).
The sandbox fixtures deploy that registry and wallet code.

## What ATTO clears

The accepted manifest identifies the name, its Intents keys, the minimum Intents token balances,
and NFTs with approvals. Its fingerprint is SHA-256 over a fixed Borsh encoding shared with the
website. A changed fingerprint requires the buyer to accept the new manifest after handover.

ATTO instructs the name to remove each Intents key and revoke each NFT approval. The caller funds
the small clearing deposit, which goes to the name for call fees. The buyer's price stays separate.
ATTO then reads the registry owner, every Intents key, the specified token balances, the wallet's
extensions, and each specified NFT's owner and approvals. Missing or malformed answers fail the check.
The manifest is limited to 24 KiB, 100 keys, 100 token balances, 100 disclosures and 12 NFTs.

Intents checks a signing key when an instruction executes. Removing a key therefore also stops
an instruction signed earlier with it. The dirty-name sandbox test first simulates a valid seller
withdrawal, completes the sale, then proves that the same signed withdrawal fails. Its token
balance remains in Intents and its NFT approvals are empty.

## Completing or returning the name

After verification, ATTO first sets the payout account to the buyer. A wallet view must confirm that payout before ATTO can schedule the NFT transfer. The wallet skips its sweep when the incoming owner
already equals the payout account, so NEAR received while ATTO held the name stays with the name.
The seller receives the price only after the final transfer succeeds.

A failed check permits reversal. Reversal sets payout to the seller before returning the NFT,
then refunds the buyer. A timeout also permits reversal before verification. If the registry
reclaims the name, a successful ownership read proving the escrow no longer owns it permits a
refund. A failed ownership read never counts as proof of loss.

## What remains a disclosure

Sub-accounts have their own keys. DAO roles belong to the DAO's contract. ATTO cannot remove either
through the parent wallet, so Title Search reports them for the buyer to consider. An NFT contract
can report its own approvals wrongly, so the report always names the contract it asked.

The registry authority can reclaim expired names and use its published transfer-revert power.
ATTO does not remove those powers. The deployed Intents code and the registry's wallet are trusted
to follow their published rules.

## Keeper reserves survive a sale

Keeper files each reserve under the name, independently of its current owner. Only the name can
configure it or withdraw to itself. A sale clears the old owner's wallet spending grant; the buyer
must enable a new grant to resume pulling earnings. Renewal pays the registry and extends the same
lease whichever account owns its NFT.

Each prepared name has a deterministic collection account below Keeper. Keeper creates it without
keys and installs fixed collection code. The wallet grant names that collection account as both
extension and sole receiver. The collector forwards actual NEAR to a payable Keeper method that
checks its account identity. Neither a spending-counter change nor a successful detached wallet
call can create reserve credit.

Setup attaches 2.1 NEAR: 2 NEAR stays in the collection account for code storage and call funding,
and 0.1 NEAR stays in Keeper for reserve records. These amounts are separate from the withdrawable
reserve. Keeper account names must be at most 39 characters so the 24-character hash label fits
NEAR's account-length limit. Setup must complete before the owner installs the grant.
Collector forwarding also includes any received gas refunds; credit always comes from the attached
NEAR, and never from the legacy `last_spent_seen` compatibility field.
