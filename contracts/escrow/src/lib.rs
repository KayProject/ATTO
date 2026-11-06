//! ATTO escrow: holds a buyer's payment and a leased name, clears the seller's
//! leftover access, checks the result on chain, then completes or reverses.
//! No owner, no admin, no upgrade method.

use atto_shared::events::AttoEvent;
use atto_shared::{
    from_hex, to_hex, ListingState, Manifest, CLEARING_TIMEOUT_NS, RECLAIM_AFTER_NS, SALE_WINDOW_NS,
};
use defuse_wallet::actions::FunctionCall;
use defuse_wallet::{NearPromise, Request};
use near_sdk::json_types::{U128, U64};

use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};

const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
/// Returned to the seller when the listing ends.
pub const LISTING_DEPOSIT: NearToken = NearToken::from_millinear(50);
/// Forwarded to the name before clearing, so it can pay 1 yocto per call.
pub const MIN_CLEAR_DEPOSIT: NearToken = NearToken::from_millinear(10);
pub const MAX_CLEAR_PAGE: u32 = 10;

const GAS_VIEW: Gas = Gas::from_tgas(10);
const GAS_CB: Gas = Gas::from_tgas(30);
const GAS_ITEM: Gas = Gas::from_tgas(8);
const GAS_SET_PAYOUT: Gas = Gas::from_tgas(60);
const GAS_TRANSFER: Gas = Gas::from_tgas(120);

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Listings,
    ByToken,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Listing {
    pub id: U64,
    pub token_id: String,
    pub tla_id: AccountId,
    pub label: String,
    pub seller: AccountId,
    pub price: U128,
    pub state: ListingState,
    pub buyer: Option<AccountId>,
    pub accepted_fingerprint: Option<String>,
    pub manifest: Option<Manifest>,
    pub cleared_upto: u32,
    pub paid_at: Option<U64>,
    pub name_at: Option<U64>,
    pub failure: Option<String>,
    /// Set while a step's cross-contract calls are in flight.
    pub busy: bool,
}

impl Listing {
    fn item_count(&self) -> u32 {
        self.manifest
            .as_ref()
            .map_or(0, |m| (m.intents_keys.len() + m.nfts.len()) as u32)
    }
    fn event_id(&self) -> (U64, String) {
        (self.id, self.token_id.clone())
    }
}

#[near(serializers = [json])]

pub struct SubAccountView {
    pub owner: AccountId,
    pub lifecycle: String,
    pub expires_at: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Escrow {
    registry: AccountId,
    intents: AccountId,
    hos_extension: AccountId,
    listings: IterableMap<u64, Listing>,
    by_token: LookupMap<String, u64>,
    next_id: u64,
}

fn split_token(token_id: &str) -> (String, AccountId) {
    let (label, tla) = token_id
        .split_once('.')
        .unwrap_or_else(|| env::panic_str("bad token id"));
    (
        label.to_string(),
        tla.parse().unwrap_or_else(|_| env::panic_str("bad tla")),
    )
}

fn result_json<T: near_sdk::serde::de::DeserializeOwned>(i: u64) -> Option<T> {
    env::promise_result_checked(i, 64 * 1024)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
}

fn result_ok(i: u64) -> bool {
    env::promise_result_checked(i, 64 * 1024).is_ok()
}

fn view(account: &AccountId, method: &str, args: Value) -> Promise {
    Promise::new(account.clone()).function_call(
        method.to_string(),
        args.to_string().into_bytes(),
        NearToken::from_yoctonear(0),
        GAS_VIEW,
    )
}

fn call_1y(account: &AccountId, method: &str, args: Value, gas: Gas) -> Promise {
    Promise::new(account.clone()).function_call(
        method.to_string(),
        args.to_string().into_bytes(),
        ONE_YOCTO,
        gas,
    )
}

#[near]
impl Escrow {
    #[init]
    pub fn new(registry: AccountId, intents: AccountId, hos_extension: AccountId) -> Self {
        Self {
            registry,
            intents,
            hos_extension,
            listings: IterableMap::new(Key::Listings),
            by_token: LookupMap::new(Key::ByToken),
            next_id: 1,
        }
    }

    // ---------- listing and payment ----------

    /// Seller lists a name they own. Attach `LISTING_DEPOSIT`.
    #[payable]
    pub fn list(&mut self, token_id: String, price: U128) -> Promise {
        require!(
            env::attached_deposit() == LISTING_DEPOSIT,
            "attach the listing deposit"
        );
        require!(price.0 > 0, "price must be positive");
        if let Some(id) = self.by_token.get(&token_id) {
            let open = self.listings.get(id).is_some_and(|l| !is_terminal(l.state));
            require!(!open, "name already listed");
        }
        let (label, tla) = split_token(&token_id);
        view(
            &self.registry,
            "get_sub_account",
            json!({ "tla_id": tla, "name": label }),
        )
        .then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB)
                .on_list_checked(
                    token_id,
                    price,
                    env::predecessor_account_id(),
                    U128(env::attached_deposit().as_yoctonear()),
                ),
        )
    }

    #[private]
    pub fn on_list_checked(
        &mut self,
        token_id: String,
        price: U128,
        seller: AccountId,
        deposit: U128,
    ) -> PromiseOrValue<U64> {
        let refuse = |why: &str| {
            let _ = Promise::new(seller.clone()).transfer(NearToken::from_yoctonear(deposit.0));
            env::log_str(why);
        };
        let Some(sub) = result_json::<SubAccountView>(0) else {
            refuse("name not found");
            return PromiseOrValue::Value(U64(0));
        };
        if self
            .by_token
            .get(&token_id)
            .and_then(|id| self.listings.get(id))
            .is_some_and(|l| !is_terminal(l.state))
        {
            refuse("name already listed");
            return PromiseOrValue::Value(U64(0));
        }
        if sub.owner != seller {
            refuse("only the owner can list");
            return PromiseOrValue::Value(U64(0));
        }
        if sub.lifecycle != "Active" || sub.expires_at.0 < env::block_timestamp() + SALE_WINDOW_NS {
            refuse("lease ends inside the sale window");
            return PromiseOrValue::Value(U64(0));
        }
        let (label, tla_id) = split_token(&token_id);
        let id = self.next_id;
        self.next_id += 1;
        let listing = Listing {
            id: U64(id),
            token_id: token_id.clone(),
            tla_id,
            label,
            seller: seller.clone(),
            price,
            state: ListingState::Listed,
            buyer: None,
            accepted_fingerprint: None,
            manifest: None,
            cleared_upto: 0,
            paid_at: None,
            name_at: None,
            failure: None,
            busy: false,
        };
        self.listings.insert(id, listing);
        self.by_token.insert(token_id.clone(), id);
        AttoEvent::Listed {
            listing_id: U64(id),
            token_id,
            seller,
            price,
        }
        .emit();
        PromiseOrValue::Value(U64(id))
    }

    pub fn delist(&mut self, listing_id: U64) {
        let l = self.get_mut(listing_id);
        require!(env::predecessor_account_id() == l.seller, "only the seller");
        require!(l.state == ListingState::Listed, "only before payment");
        l.state = ListingState::Cancelled;
        let (id, token_id) = l.event_id();
        let seller = l.seller.clone();
        let _ = Promise::new(seller).transfer(LISTING_DEPOSIT);
        AttoEvent::Cancelled {
            listing_id: id,
            token_id,
            refunded: None,
        }
        .emit();
    }

    /// Buyer pays exactly the price and records the report they accepted.
    #[payable]
    pub fn pay(&mut self, listing_id: U64, fingerprint: String) {
        require!(
            from_hex(&fingerprint).is_some(),
            "fingerprint must be 64 hex chars"
        );
        let buyer = env::predecessor_account_id();
        let l = self.get_mut(listing_id);
        require!(l.state == ListingState::Listed, "listing is not open");
        require!(
            env::attached_deposit().as_yoctonear() == l.price.0,
            "attach exactly the price"
        );
        require!(buyer != l.seller, "seller cannot buy");
        l.state = ListingState::Paid;
        l.buyer = Some(buyer.clone());
        l.accepted_fingerprint = Some(fingerprint.clone());
        l.paid_at = Some(U64(env::block_timestamp()));
        let (id, token_id) = l.event_id();
        AttoEvent::Paid {
            listing_id: id,
            token_id,
            buyer,
            price: l.price,
            fingerprint,
        }
        .emit();
    }

    /// Buyer cancels before the name arrives. Full refund.
    pub fn cancel(&mut self, listing_id: U64) {
        let l = self.get_mut(listing_id);
        require!(
            l.buyer.as_ref() == Some(&env::predecessor_account_id()),
            "only the buyer"
        );
        self.refund_unpaid_handover(listing_id);
    }

    /// Anyone, 48 hours after payment, if the name never arrived. Full refund to the buyer.
    pub fn reclaim_payment(&mut self, listing_id: U64) {
        let l = self.get(listing_id);
        let paid_at = l.paid_at.map_or(0, |t| t.0);
        require!(
            env::block_timestamp() >= paid_at + RECLAIM_AFTER_NS,
            "wait 48 hours after paying"
        );
        self.refund_unpaid_handover(listing_id);
    }

    fn refund_unpaid_handover(&mut self, listing_id: U64) {
        let l = self.get_mut(listing_id);
        require!(
            l.state == ListingState::Paid,
            "name already handed over or not paid"
        );
        l.state = ListingState::Cancelled;
        let buyer = l.buyer.clone().unwrap();
        let (price, seller) = (l.price, l.seller.clone());
        let (id, token_id) = l.event_id();
        let _ = Promise::new(buyer.clone()).transfer(NearToken::from_yoctonear(price.0));
        let _ = Promise::new(seller).transfer(LISTING_DEPOSIT);
        AttoEvent::Cancelled {
            listing_id: id,
            token_id,
            refunded: Some(buyer),
        }
        .emit();
    }

    // ---------- handover ----------

    /// NEP-171 receiver. The seller sends the name with `nft_transfer_call`, `msg` = listing id.
    /// Returns `true` (send it back) unless every check passes.
    pub fn nft_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_id: AccountId,
        token_id: String,
        msg: String,
    ) -> bool {
        if env::predecessor_account_id() != self.registry {
            return true;
        }
        let Ok(id) = msg.trim().parse::<u64>() else {
            return true;
        };
        let Some(l) = self.listings.get_mut(&id) else {
            return true;
        };
        let ok = l.state == ListingState::Paid
            && l.token_id == token_id
            && l.seller == previous_owner_id
            && l.seller == sender_id;
        if !ok {
            return true;
        }
        l.state = ListingState::NameHeld;
        l.name_at = Some(U64(env::block_timestamp()));
        AttoEvent::NameReceived {
            listing_id: l.id,
            token_id,
        }
        .emit();
        false
    }

    // ---------- clearing ----------

    /// Anyone posts the final manifest. If it differs from what the buyer accepted,
    /// only the buyer may post it, which accepts the new report.
    pub fn post_manifest(&mut self, listing_id: U64, manifest: Manifest) {
        let caller = env::predecessor_account_id();
        let l = self.get_mut(listing_id);
        require!(l.state == ListingState::NameHeld, "name not held");
        require!(
            manifest.token_id == l.token_id,
            "manifest is for another name"
        );
        require!(
            manifest.intents_keys.len() <= 100
                && manifest.nfts.len() <= 12
                && manifest.intents_floor.len() <= 100
                && manifest.needs_seller.len() <= 100
                && serde_json::to_vec(&manifest).is_ok_and(|bytes| bytes.len() <= 24 * 1024),
            "manifest too large"
        );
        let fp = to_hex(&manifest.fingerprint());
        let by_buyer = Some(&fp) != l.accepted_fingerprint.as_ref();
        if by_buyer {
            require!(
                l.buyer.as_ref() == Some(&caller),
                "changed report needs the buyer"
            );
            l.accepted_fingerprint = Some(fp.clone());
        }
        l.manifest = Some(manifest);
        l.state = ListingState::Clearing;
        let (id, token_id) = l.event_id();
        AttoEvent::ManifestPosted {
            listing_id: id,
            token_id,
            fingerprint: fp,
            accepted_by_buyer: by_buyer,
        }
        .emit();
    }

    /// Makes the name remove up to `count` Intents keys and NFT approvals.
    /// Attach at least `MIN_CLEAR_DEPOSIT`; it is forwarded to the name to pay call fees.
    #[payable]
    pub fn clear(&mut self, listing_id: U64, count: u32) -> Promise {
        require!(
            env::attached_deposit() >= MIN_CLEAR_DEPOSIT,
            "attach the clearing deposit"
        );
        let intents = self.intents.clone();
        let l = self.get_mut(listing_id);
        require!(
            l.state == ListingState::Clearing && l.failure.is_none(),
            "not clearing"
        );
        let total = l.item_count();
        require!(l.cleared_upto < total, "nothing left to clear");
        let m = l.manifest.clone().unwrap();
        let from = l.cleared_upto;
        let upto = (from + count.clamp(1, MAX_CLEAR_PAGE)).min(total);
        let keys_len = m.intents_keys.len() as u32;
        let mut calls = Vec::new();
        let (mut keys_removed, mut nfts_revoked) = (Vec::new(), Vec::new());
        for i in from..upto {
            if i < keys_len {
                let key = m.intents_keys[i as usize].clone();
                calls.push(name_call(
                    &intents,
                    "remove_public_key",
                    json!({ "public_key": key }),
                ));
                keys_removed.push(key);
            } else {
                let nft = m.nfts[(i - keys_len) as usize].clone();
                let contract: AccountId = nft
                    .contract_id
                    .parse()
                    .unwrap_or_else(|_| env::panic_str("bad nft contract"));
                calls.push(name_call(
                    &contract,
                    "nft_revoke_all",
                    json!({ "token_id": nft.token_id }),
                ));
                nfts_revoked.push(nft);
            }
        }
        l.cleared_upto = upto;
        let name: AccountId = l.token_id.parse().unwrap();
        let gas = Gas::from_tgas(20 + 10 * calls.len() as u64);
        let (id, token_id) = l.event_id();
        AttoEvent::Cleared {
            listing_id: id,
            token_id,
            keys_removed,
            nfts_revoked,
        }
        .emit();
        let request = Request::new().external(calls);
        Promise::new(name)
            .transfer(env::attached_deposit())
            .function_call(
                "w_execute_extension".to_string(),
                json!({ "request": request }).to_string().into_bytes(),
                ONE_YOCTO,
                gas,
            )
    }

    /// Reads, on chain, that clearing worked. Anyone may call once every item is cleared.
    pub fn verify(&mut self, listing_id: U64) -> Promise {
        let (registry, intents) = (self.registry.clone(), self.intents.clone());
        let l = self.get_mut(listing_id);
        require!(
            l.state == ListingState::Clearing && !l.busy && l.failure.is_none(),
            "not ready to verify"
        );
        require!(l.cleared_upto == l.item_count(), "clear every item first");
        l.busy = true;
        let m = l.manifest.clone().unwrap();
        let name = l.token_id.clone();
        let floor_ids: Vec<String> = m.intents_floor.iter().map(|t| t.token_id.clone()).collect();
        let mut p = view(
            &registry,
            "get_sub_account",
            json!({ "tla_id": l.tla_id, "name": l.label }),
        )
        .and(view(
            &intents,
            "public_keys_of",
            json!({ "account_id": name }),
        ))
        .and(view(
            &intents,
            "mt_batch_balance_of",
            json!({ "account_id": name, "token_ids": floor_ids }),
        ))
        .and(view(&name.parse().unwrap(), "w_extensions", json!({})));
        for nft in &m.nfts {
            let contract: AccountId = nft.contract_id.parse().unwrap();
            p = p.and(view(
                &contract,
                "nft_token",
                json!({ "token_id": nft.token_id }),
            ));
        }
        p.then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB)
                .on_verified(listing_id),
        )
    }

    #[private]
    pub fn on_verified(&mut self, listing_id: U64) {
        let me = env::current_account_id();
        let hos_extension = self.hos_extension.clone();
        let l = self.get_mut(listing_id);
        l.busy = false;
        let m = l.manifest.clone().unwrap();
        let name = l.token_id.clone();
        let failure = check(&m, &name, &me, &hos_extension);
        let (id, token_id) = l.event_id();
        match failure {
            None => {
                l.state = ListingState::Verified;
                AttoEvent::Verified {
                    listing_id: id,
                    token_id,
                }
                .emit();
            }
            Some(reason) => {
                l.failure = Some(reason.clone());
                AttoEvent::CheckFailed {
                    listing_id: id,
                    token_id,
                    reason,
                }
                .emit();
            }
        }
    }

    // ---------- settlement ----------

    /// Points the payout at the buyer (so nothing is swept), sends the name, then pays the seller.
    pub fn complete(&mut self, listing_id: U64) -> Promise {
        let registry = self.registry.clone();
        let l = self.get_mut(listing_id);
        require!(l.state == ListingState::Verified && !l.busy, "not verified");
        l.busy = true;
        let buyer = l.buyer.clone().unwrap();
        hand_name(&registry, l, &buyer).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB)
                .on_completed(listing_id),
        )
    }

    #[private]
    pub fn on_payout_set(&self, listing_id: U64, receiver_id: AccountId) -> Promise {
        require!(result_ok(0), "payout update failed");
        let name: AccountId = self.get(listing_id).token_id.parse().unwrap();
        view(&name, "hos_payout_account", json!({})).then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(140))
                .on_payout_verified(listing_id, receiver_id),
        )
    }
    #[private]
    pub fn on_payout_verified(&self, listing_id: U64, receiver_id: AccountId) -> Promise {
        require!(
            result_json::<AccountId>(0).as_ref() == Some(&receiver_id),
            "wallet payout update not confirmed"
        );
        let l = self.get(listing_id);
        call_1y(
            &self.registry,
            "nft_transfer",
            json!({"receiver_id":receiver_id,"token_id":l.token_id,"approval_id":null,"memo":null}),
            GAS_TRANSFER,
        )
    }

    #[private]
    pub fn on_completed(&mut self, listing_id: U64) {
        let ok = result_ok(0);
        let l = self.get_mut(listing_id);
        l.busy = false;
        if !ok {
            env::log_str("transfer to buyer failed; complete can be retried");
            return;
        }
        l.state = ListingState::Completed;
        let (seller, buyer, price) = (l.seller.clone(), l.buyer.clone().unwrap(), l.price);
        let (id, token_id) = l.event_id();
        let _ = Promise::new(seller.clone())
            .transfer(NearToken::from_yoctonear(price.0).saturating_add(LISTING_DEPOSIT));
        AttoEvent::Completed {
            listing_id: id,
            token_id,
            seller,
            buyer,
            price,
        }
        .emit();
    }

    /// Returns the name to the seller and the payment to the buyer. Allowed once a check
    /// failed, or 24 hours after handover if the sale never verified.
    pub fn reverse(&mut self, listing_id: U64) -> Promise {
        let registry = self.registry.clone();
        let l = self.get_mut(listing_id);
        let held = matches!(
            l.state,
            ListingState::NameHeld | ListingState::Clearing | ListingState::Verified
        );
        require!(held && !l.busy, "nothing to reverse");
        let timed_out = l.state != ListingState::Verified
            && env::block_timestamp()
                >= l.name_at
                    .map_or(u64::MAX, |t| t.0)
                    .saturating_add(CLEARING_TIMEOUT_NS);
        require!(
            l.failure.is_some() || timed_out,
            "no failed check and not timed out"
        );
        if l.failure.is_none() {
            l.failure = Some("timed out before verification".into());
        }
        l.busy = true;
        let seller = l.seller.clone();
        hand_name(&registry, l, &seller).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB)
                .on_reversed(listing_id),
        )
    }

    #[private]
    pub fn on_reversed(&mut self, listing_id: U64) {
        let ok = result_ok(0);
        let l = self.get_mut(listing_id);
        l.busy = false;
        if !ok {
            env::log_str("return to seller failed; reverse or settle_lost can be retried");
            return;
        }
        self.finish_reversal(listing_id);
    }

    /// If the escrow no longer owns the name (for example the registry reclaimed it),
    /// anyone can refund the buyer.
    pub fn settle_lost(&mut self, listing_id: U64) -> Promise {
        let registry = self.registry.clone();
        let l = self.get_mut(listing_id);
        let held = matches!(
            l.state,
            ListingState::NameHeld | ListingState::Clearing | ListingState::Verified
        );
        require!(held && !l.busy, "nothing to settle");
        l.busy = true;
        view(
            &registry,
            "get_sub_account",
            json!({ "tla_id": l.tla_id, "name": l.label }),
        )
        .then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB)
                .on_lost_checked(listing_id),
        )
    }

    #[private]
    pub fn on_lost_checked(&mut self, listing_id: U64) {
        let Some(sub) = result_json::<Option<SubAccountView>>(0) else {
            self.get_mut(listing_id).busy = false;
            env::log_str("could not read ownership; retry settlement");
            return;
        };
        let still_ours = sub.is_some_and(|s| s.owner == env::current_account_id());
        let l = self.get_mut(listing_id);
        l.busy = false;
        if still_ours {
            env::log_str("the escrow still holds the name; settlement refused");
            return;
        }
        l.failure = Some("the escrow no longer holds the name".into());
        self.finish_reversal(listing_id);
    }

    fn finish_reversal(&mut self, listing_id: U64) {
        let l = self.get_mut(listing_id);
        l.state = ListingState::Reversed;
        let (buyer, seller, price) = (l.buyer.clone().unwrap(), l.seller.clone(), l.price);
        let reason = l.failure.clone().unwrap_or_default();
        let (id, token_id) = l.event_id();
        let _ = Promise::new(buyer).transfer(NearToken::from_yoctonear(price.0));
        let _ = Promise::new(seller).transfer(LISTING_DEPOSIT);
        AttoEvent::Reversed {
            listing_id: id,
            token_id,
            reason,
        }
        .emit();
    }

    // ---------- views ----------

    pub fn get_listing(&self, listing_id: U64) -> Option<Listing> {
        self.listings.get(&listing_id.0).cloned()
    }

    pub fn listing_for_token(&self, token_id: String) -> Option<Listing> {
        self.by_token
            .get(&token_id)
            .and_then(|id| self.listings.get(id))
            .cloned()
    }

    pub fn listings_for(
        &self,
        account_id: AccountId,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<Listing> {
        self.listings
            .values()
            .filter(|l| l.seller == account_id || l.buyer.as_ref() == Some(&account_id))
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .cloned()
            .collect()
    }

    pub fn config(&self) -> Value {
        json!({ "registry": self.registry, "intents": self.intents, "hos_extension": self.hos_extension })
    }
}

impl Escrow {
    fn get(&self, id: U64) -> &Listing {
        self.listings
            .get(&id.0)
            .unwrap_or_else(|| env::panic_str("no such listing"))
    }
    fn get_mut(&mut self, id: U64) -> &mut Listing {
        self.listings
            .get_mut(&id.0)
            .unwrap_or_else(|| env::panic_str("no such listing"))
    }
}

fn is_terminal(s: ListingState) -> bool {
    matches!(
        s,
        ListingState::Completed | ListingState::Reversed | ListingState::Cancelled
    )
}

/// A call the name makes in its own name, paying 1 yocto from its balance.
fn name_call(to: &AccountId, method: &str, args: Value) -> NearPromise {
    NearPromise::new(to.clone()).function_call(
        FunctionCall::name(method)
            .args(args.to_string().into_bytes())
            .gas(GAS_ITEM)
            .attach_deposit(ONE_YOCTO),
    )
}

/// Points the payout at `to`, then transfers the name to `to`. With payout already
/// equal to the new owner, the wallet sweeps nothing.
fn hand_name(registry: &AccountId, l: &Listing, to: &AccountId) -> Promise {
    call_1y(
        registry,
        "set_payout_account",
        json!({ "tla_id": l.tla_id, "name": l.label, "new_payout_account": to }),
        GAS_SET_PAYOUT,
    )
    .then(
        Escrow::ext(env::current_account_id())
            .with_static_gas(Gas::from_tgas(165))
            .on_payout_set(l.id, to.clone()),
    )
}

/// Promise results, in order: sub-account, Intents keys, Intents balances, extensions, then one per NFT.
fn check(m: &Manifest, name: &str, me: &AccountId, hos_extension: &AccountId) -> Option<String> {
    let Some(sub) = result_json::<SubAccountView>(0) else {
        return Some("could not read the lease".into());
    };
    if &sub.owner != me {
        return Some("the escrow no longer holds the name".into());
    }
    match result_json::<Vec<String>>(1) {
        Some(keys) if keys.is_empty() => {}
        Some(keys) => return Some(format!("Intents keys remain: {}", keys.join(", "))),
        None => return Some("could not read Intents keys".into()),
    }
    let Some(balances) = result_json::<Vec<U128>>(2) else {
        return Some("could not read Intents balances".into());
    };
    if balances.len() != m.intents_floor.len() {
        return Some("incomplete Intents balances".into());
    }
    for (want, have) in m.intents_floor.iter().zip(balances.iter()) {
        if have.0 < want.amount.0 {
            return Some(format!(
                "Intents balance of {} fell below what the buyer was shown",
                want.token_id
            ));
        }
    }
    let Some(extensions) = result_json::<Vec<AccountId>>(3) else {
        return Some("could not read the name's helpers".into());
    };
    if !extensions.contains(me) || !extensions.contains(hos_extension) {
        return Some("missing required helper".into());
    }
    if let Some(extra) = extensions.iter().find(|e| *e != me && *e != hos_extension) {
        return Some(format!("unexpected helper on the name: {extra}"));
    }
    for (i, nft) in m.nfts.iter().enumerate() {
        let token: Option<Value> = result_json(4 + i as u64);
        let Some(token) = token.filter(|t| !t.is_null()) else {
            return Some(format!(
                "NFT {}:{} not found",
                nft.contract_id, nft.token_id
            ));
        };
        if token["owner_id"].as_str() != Some(name) {
            return Some(format!(
                "NFT {}:{} is no longer held by the name",
                nft.contract_id, nft.token_id
            ));
        }
        let approvals = &token["approved_account_ids"];
        if !approvals.as_object().is_some_and(|o| o.is_empty()) {
            return Some(format!(
                "NFT {}:{} still has approvals",
                nft.contract_id, nft.token_id
            ));
        }
    }
    None
}
