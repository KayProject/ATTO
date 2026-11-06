# ATTO threat model: how a seller could try to keep access

A rented NEAR name is an NFT and a working account at once. When it is sold, the buyer should get
the account and nothing the seller can still reach. This document lists every way we found for a
seller to keep a hold on the name or its money after a Clean Sale, what stops each one, and the
test that tries it.

The list comes from reading the registry (`houseofstake/tla-contracts`, commit `d85860a`), the
name's wallet (`hos-wallet`) and NEAR Intents (`near/intents`). Line references are in
`HOW-CONTROL-PASSES.md`.

## What the registry already does on every change of owner

These hold for any transfer, with or without ATTO:

- Every helper account (extension) the old owner added is removed, except the registry's own.
- Every spending allowance on the name's wallet is deleted.
- A wallet the old owner froze is unfrozen.
- The name's NEAR is sent to the old owner's payout account, unless the new owner already is the
  payout account.
- The transfer is refused while the name holds any token on the registry's allowlist.
- The name has no access keys and its signed-message path is closed, so nobody can sign for the
  account directly.

ATTO adds what the registry cannot see: connections the name made inside other programs.

## The sale, in the order that matters

1. The buyer pays the escrow and records the fingerprint of the report they read.
2. The seller sends the name to the escrow. From here the escrow is the owner and the seller can
   no longer make the name do anything.
3. A final report is built. If it differs from the one the buyer accepted, only the buyer can
   accept the new one.
4. The escrow makes the name remove its Intents keys and revoke approvals on its NFTs.
5. The escrow reads the results back on chain.
6. Only if every check passes does the name go to the buyer and the money to the seller.
   Otherwise the name goes back to the seller and the money back to the buyer.

## Threats

| ID | The seller tries to... | What stops it | Test |
|:--|:--|:--|:--|
| T1 | Keep a signing key registered for the name in NEAR Intents and use it later | `clear` makes the name call `remove_public_key` for every key; `verify` reads `public_keys_of` and requires an empty list | `t01_intents_key_removed` |
| T2 | Switch Intents to "signed messages only" so the name can't remove keys by direct call | The report rates it Needs the seller. If keys remain, `verify` fails and the sale reverses | `t02_signed_only_reverses` |
| T3 | Use a held Intents key in the gap between handover and clearing to move the name's Intents balance out | `verify` requires each Intents balance to be at least what the buyer was shown; if not, the sale reverses | `t03_drain_in_gap_reverses` |
| T4 | Keep an approval on an NFT the name holds, so another account can move it | `clear` calls `nft_revoke_all` for each listed NFT; `verify` checks the name still holds it and no approvals remain | `t04_nft_approval_revoked` |
| T5 | Add keys or approvals after the buyer read the report | After handover the seller is not the owner and can add nothing. The final manifest must match the buyer's fingerprint, or be posted by the buyer | `t05_changed_manifest_needs_buyer` |
| T6 | Move NFTs or Intents money out before handing over | The final report differs from the accepted one, so the buyer must accept it or the sale reverses | `t06_missing_item_reverses` |
| T7 | Keep a sub-account such as `shop.bakery.food` with their own key | Nobody but its key holder can change it. The report lists it as Needs the seller and the buyer decides | `t07_report_lists_sub_account` |
| T8 | Keep a role in a DAO through the name | Only the DAO can change it. Listed as Needs the seller | `t08_report_lists_dao_role` |
| T9 | Put an access key on the name itself | The wallet refuses calls to itself and has signing closed. The report also lists the name's access keys and expects none | `t09_name_has_no_keys` |
| T10 | Keep a helper (extension) on the name | The registry removes every extension except its own on a change of owner; `verify` checks the list is the registry plus the escrow | `t10_extensions_after_sale` |
| T11 | Keep a spending allowance | The registry deletes every allowance on a change of owner | `t11_grants_empty_after_sale` |
| T12 | Collect money paid to the name while the escrow holds it | `complete` points the payout account at the buyer before the final transfer. The wallet then skips the sweep, so the NEAR stays in the name for the buyer | `t12_payment_during_escrow_reaches_buyer` |
| T13 | Let the lease run out during the sale | `list` refuses leases that end within 72 hours. If the registry reclaims anyway, `verify` sees the escrow no longer owns the name and the buyer is refunded | `t13_reclaim_mid_sale_refunds_buyer` |
| T14 | Take the buyer's money and never send the name | The seller never touches the money before completion. The buyer can cancel any time before handover and reclaim after 48 hours | `t14_no_show_refund` |
| T15 | Send the name with another listing's id, or fake the registry's call | `nft_on_transfer` checks the caller is the registry, the sender is this listing's seller, the token matches and the listing is paid. Anything else answers "send it back" | `t15_wrong_listing_returns_name` |
| T16 | Have ATTO's builders take the escrowed money or names | No owner, no admin method, no upgrade method. The escrow account's keys are deleted after deployment | `t16_escrow_has_no_keys` |
| T17 | Use House of Stake's 5-minute revert window | Only the registry's authority can revert, not the seller. Stated as a trust assumption in the README | documented |
| T18 | Pull more than agreed from the name's earnings through Keeper | The wallet caps the allowance at one year's rent, with Keeper as the only receiver. The money stays in the name's reserve, which only the name can withdraw | `t18_pull_past_cap_refused` |
| T19 | Sell during a renewal | Renewal and sale touch different state. The renewal extends the lease whoever owns the name | `sale_mid_renewal` |
| T20 | Use a held Intents key in the gap to add a new key, or to switch on "signed messages only" | `verify` reads the keys and the mode after clearing. Anything left reverses the sale. The seller gains nothing and the buyer is refunded | `t20_key_added_in_gap_reverses` |
| T21 | Sign an Intents instruction before the sale and submit it after | Intents checks the signing key when the instruction runs. Once `clear` removed the key, it fails | `t21_presigned_intent_refused` |

## Found while building

- **The name is empty after handover.** The handover sweeps the name's NEAR to the seller, so the
  name cannot pay the one-yoctoNEAR fee that each Intents and NFT call needs. `clear` therefore
  takes a small deposit from whoever calls it and passes it to the name first. The buyer's payment
  is never used for this.

## Out of scope, stated plainly

- Money the seller took out before listing. The report shows what is there when the buyer reads it.
- Sub-accounts and DAO roles. ATTO reports them; only their holders can remove them.
- Tokens and programs that ATTO's indexer has never seen the name use.
- Names under business endings whose licensee has not enabled resale. The registry refuses those
  transfers, and ATTO shows them as not supported.
