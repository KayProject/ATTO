use atto_shared::events::AttoEvent;
use atto_shared::{to_hex, RENEW_MARGIN_BPS, RENEW_WINDOW_NS};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
const SETUP: NearToken = NearToken::from_millinear(2100);
const COLLECTOR_FLOAT: NearToken = NearToken::from_near(2);
const ONE: NearToken = NearToken::from_yoctonear(1);
const COLLECTOR_CODE: &[u8] =
    include_bytes!("../../target/near/atto_collector/atto_collector.wasm");

#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Reserve {
    pub name: AccountId,
    pub last_spent_seen: U128,
    pub balance: U128,
    pub enabled: bool,
    pub share_bps: u16,
    pub puller: AccountId,
    pub collector: AccountId,
    pub ready: bool,
    pub busy: bool,
    pub expires_at: U64,
    pub owed_by_registry: U128,
    pub pending_amount: U128,
    pub pending_rent: U128,
}
#[near(serializers=[borsh])]
#[derive(BorshStorageKey)]
enum Key {
    Reserves,
}
#[near(serializers=[borsh,json])]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RenewalPhase {
    Idle,
    Checking,
    Calling,
    Observing,
    NeedsReconcile,
    RefundReady,
    QuotingRefund,
    Collecting,
    ConfirmingRefund,
    NeedsRefundConfirmation,
}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Keeper {
    registry: AccountId,
    reserves: IterableMap<AccountId, Reserve>,
    renewing: Option<AccountId>,
    generation: u64,
    phase: RenewalPhase,
}
fn split(name: &AccountId) -> (String, AccountId) {
    let (label, tla) = name
        .as_str()
        .split_once('.')
        .unwrap_or_else(|| env::panic_str("invalid name"));
    (label.into(), tla.parse().unwrap())
}
fn read<T: near_sdk::serde::de::DeserializeOwned>(i: u64) -> Option<T> {
    env::promise_result_checked(i, 64 * 1024)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
}
fn ok() -> bool {
    env::promise_result_checked(0, 64 * 1024).is_ok()
}
fn call(to: &AccountId, method: &str, args: Value, deposit: NearToken, gas: u64) -> Promise {
    Promise::new(to.clone()).function_call(
        method,
        args.to_string().into_bytes(),
        deposit,
        Gas::from_tgas(gas),
    )
}
fn view(to: &AccountId, method: &str, args: Value) -> Promise {
    call(to, method, args, NearToken::from_yoctonear(0), 10)
}
#[near]
impl Keeper {
    #[init]
    pub fn new(registry: AccountId) -> Self {
        Self {
            registry,
            reserves: IterableMap::new(Key::Reserves),
            renewing: None,
            generation: 0,
            phase: RenewalPhase::Idle,
        }
    }
    pub fn collector_for(&self, name: AccountId) -> AccountId {
        let hash = to_hex(&env::sha256_array(name.as_bytes()));
        format!("{}.{}", &hash[..24], env::current_account_id())
            .parse()
            .unwrap_or_else(|_| env::panic_str("keeper account must be at most 39 characters"))
    }
    #[payable]
    pub fn prepare(&mut self, name: AccountId) -> Promise {
        require!(
            env::attached_deposit() == SETUP,
            "attach exactly 2.1 NEAR for collector setup"
        );
        require!(!self.reserves.contains_key(&name), "already prepared");
        let collector = self.collector_for(name.clone());
        self.reserves.insert(
            name.clone(),
            Reserve {
                name: name.clone(),
                last_spent_seen: U128(0),
                balance: U128(0),
                enabled: false,
                share_bps: 0,
                puller: env::predecessor_account_id(),
                collector,
                ready: false,
                busy: true,
                expires_at: U64(0),
                owed_by_registry: U128(0),
                pending_amount: U128(0),
                pending_rent: U128(0),
            },
        );
        let (label, tla) = split(&name);
        view(
            &self.registry,
            "get_sub_account",
            json!({"tla_id":tla,"name":label}),
        )
        .then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(70))
                .on_prepare_checked(name, env::predecessor_account_id()),
        )
    }
    #[private]
    pub fn on_prepare_checked(&mut self, name: AccountId, payer: AccountId) -> Promise {
        let valid =
            read::<Value>(0).is_some_and(|v| v["owner"].is_string() && v["lifecycle"] == "Active");
        if !valid {
            self.reserves.remove(&name);
            return Promise::new(payer).transfer(SETUP);
        }
        if let Some(expiry) = read::<Value>(0)
            .and_then(|v| v["expires_at"].as_str().and_then(|s| s.parse::<u64>().ok()))
        {
            self.reserves.get_mut(&name).unwrap().expires_at = U64(expiry);
        }
        let collector = self.reserves.get(&name).unwrap().collector.clone();
        Promise::new(collector)
            .create_account()
            .transfer(COLLECTOR_FLOAT)
            .deploy_contract(COLLECTOR_CODE.to_vec())
            .function_call(
                "new",
                json!({"keeper":env::current_account_id(),"name":name})
                    .to_string()
                    .into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(10),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_prepared(name, payer),
            )
    }
    #[private]
    pub fn on_prepared(&mut self, name: AccountId, payer: AccountId) {
        if ok() {
            let r = self.reserves.get_mut(&name).unwrap();
            r.ready = true;
            r.busy = false;
        } else {
            self.reserves.remove(&name);
            let _ = Promise::new(payer).transfer(SETUP);
        }
    }
    pub fn configure(&mut self, enabled: bool, share_bps: u16, puller: AccountId) {
        require!(share_bps <= 10_000, "share exceeds 100 percent");
        let name = env::predecessor_account_id();
        let r = self.ready_mut(&name);
        r.enabled = enabled;
        r.share_bps = share_bps;
        r.puller = puller.clone();
        AttoEvent::Configured {
            name,
            enabled,
            share_bps,
            puller,
        }
        .emit();
    }
    #[payable]
    pub fn top_up(&mut self, name: AccountId) {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "attach funds");
        let r = self
            .reserves
            .get_mut(&name)
            .unwrap_or_else(|| env::panic_str("prepare the name first"));
        require!(r.ready, "collector not ready");
        r.balance.0 = r.balance.0.checked_add(amount).unwrap();
        AttoEvent::ToppedUp {
            name,
            by: env::predecessor_account_id(),
            amount: U128(amount),
        }
        .emit();
    }
    #[payable]
    pub fn credit_collector(&mut self, name: AccountId) {
        let r = self
            .reserves
            .get_mut(&name)
            .unwrap_or_else(|| env::panic_str("unknown name"));
        require!(
            r.ready && env::predecessor_account_id() == r.collector,
            "only name collector"
        );
        let amount = env::attached_deposit().as_yoctonear();
        r.balance.0 = r.balance.0.checked_add(amount).unwrap();
        AttoEvent::Pulled {
            name,
            amount: U128(amount),
        }
        .emit();
    }
    pub fn pull(&mut self, name: AccountId, amount: U128) -> Promise {
        let r = self.ready_mut(&name);
        require!(
            r.enabled && env::predecessor_account_id() == r.puller,
            "only enabled puller"
        );
        require!(amount.0 > 0, "amount must be positive");
        call(&r.collector, "pull", json!({"amount":amount}), ONE, 60)
    }
    pub fn sync(&self, name: AccountId) -> Promise {
        let r = self
            .reserves
            .get(&name)
            .unwrap_or_else(|| env::panic_str("unknown name"));
        require!(r.ready, "collector not ready");
        call(
            &r.collector,
            "sync",
            json!({}),
            NearToken::from_yoctonear(0),
            35,
        )
    }
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        let name = env::predecessor_account_id();
        let r = self.ready_mut(&name);
        require!(
            amount.0 > 0 && amount.0 <= r.balance.0,
            "insufficient reserve"
        );
        r.balance.0 -= amount.0;
        r.busy = true;
        Promise::new(name.clone())
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_withdrawn(name, amount),
            )
    }
    #[private]
    pub fn on_withdrawn(&mut self, name: AccountId, amount: U128) {
        let success = ok();
        let r = self.reserves.get_mut(&name).unwrap();
        r.busy = false;
        if success {
            AttoEvent::Withdrawn { name, amount }.emit();
        } else {
            r.balance.0 += amount.0;
        }
    }
    pub fn renew(&mut self, name: AccountId) -> Promise {
        require!(self.renewing.is_none(), "another renewal is pending");
        let r = self.ready_mut(&name);
        require!(r.enabled, "keeper disabled");
        r.busy = true;
        self.renewing = Some(name.clone());
        self.generation = self.generation.checked_add(1).unwrap();
        self.phase = RenewalPhase::Checking;
        let operation = U64(self.generation);
        let (label, tla) = split(&name);
        view(
            &self.registry,
            "get_sub_account",
            json!({"tla_id":tla,"name":label}),
        )
        .and(view(
            &self.registry,
            "get_rent_price",
            json!({"tla_id":tla,"name":label}),
        ))
        .then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(230))
                .on_renew_checked(name, operation),
        )
    }
    #[private]
    pub fn on_renew_checked(&mut self, name: AccountId, operation: U64) -> PromiseOrValue<bool> {
        self.assert_renewal(&name, operation, RenewalPhase::Checking);
        let sub = read::<Value>(0);
        let price = read::<Value>(1);
        let expiry = sub
            .as_ref()
            .and_then(|v| v["expires_at"].as_str())
            .and_then(|s| s.parse::<u64>().ok());
        let rent = price
            .as_ref()
            .and_then(|v| v["rent_yocto"].as_str())
            .and_then(|s| s.parse::<u128>().ok());
        let r = self.reserves.get_mut(&name).unwrap();
        if let Some(expiry) = expiry {
            r.expires_at = U64(expiry);
        }
        let eligible = expiry.zip(rent).filter(|(e, p)| {
            *p > 0 && *e <= env::block_timestamp().saturating_add(RENEW_WINDOW_NS)
        });
        let Some((expiry, rent)) = eligible else {
            r.busy = false;
            self.renewing = None;
            self.phase = RenewalPhase::Idle;
            return PromiseOrValue::Value(false);
        };
        let amount = rent.checked_mul(10_000 + RENEW_MARGIN_BPS).unwrap() / 10_000;
        if r.balance.0 < amount {
            r.busy = false;
            self.renewing = None;
            self.phase = RenewalPhase::Idle;
            return PromiseOrValue::Value(false);
        }
        r.balance.0 -= amount;
        r.expires_at = U64(expiry);
        r.pending_amount = U128(amount);
        r.pending_rent = U128(rent);
        self.phase = RenewalPhase::Calling;
        let (label, tla) = split(&name);
        PromiseOrValue::Promise(
            call(
                &self.registry,
                "renew_sub_account",
                json!({"tla_id":tla,"name":label}),
                NearToken::from_yoctonear(amount),
                100,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(105))
                    .on_renew_called(name, U128(amount), U128(rent), operation),
            ),
        )
    }
    #[private]
    pub fn on_renew_called(
        &mut self,
        name: AccountId,
        amount: U128,
        rent: U128,
        operation: U64,
    ) -> PromiseOrValue<bool> {
        self.assert_renewal(&name, operation, RenewalPhase::Calling);
        if !ok() {
            let r = self.reserves.get_mut(&name).unwrap();
            r.balance.0 += amount.0;
            r.pending_amount = U128(0);
            r.pending_rent = U128(0);
            r.busy = false;
            self.renewing = None;
            self.phase = RenewalPhase::Idle;
            AttoEvent::RenewFailed {
                name,
                attempted: amount,
            }
            .emit();
            return PromiseOrValue::Value(false);
        }
        self.phase = RenewalPhase::Observing;
        let (label, tla) = split(&name);
        PromiseOrValue::Promise(
            view(
                &self.registry,
                "get_sub_account",
                json!({"tla_id":tla,"name":label}),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(85))
                    .on_renew_observed(name, amount, rent, operation),
            ),
        )
    }
    #[private]
    pub fn on_renew_observed(
        &mut self,
        name: AccountId,
        _amount: U128,
        _rent: U128,
        operation: U64,
    ) -> PromiseOrValue<bool> {
        self.assert_renewal(&name, operation, RenewalPhase::Observing);
        let expiry = read::<Value>(0)
            .and_then(|v| v["expires_at"].as_str().and_then(|s| s.parse::<u64>().ok()));
        let r = self.reserves.get_mut(&name).unwrap();
        let Some(expiry) = expiry else {
            self.phase = RenewalPhase::NeedsReconcile;
            return PromiseOrValue::Value(false);
        };
        if expiry > r.expires_at.0 {
            r.expires_at = U64(expiry);
        }
        self.phase = RenewalPhase::RefundReady;
        PromiseOrValue::Promise(self.collect_refunds())
    }
    pub fn reconcile_renewal(&mut self) -> Promise {
        require!(
            self.phase == RenewalPhase::NeedsReconcile,
            "renewal observation not awaiting retry"
        );
        self.phase = RenewalPhase::Observing;
        let operation = U64(self.generation);
        let name = self
            .renewing
            .clone()
            .unwrap_or_else(|| env::panic_str("no pending renewal"));
        let r = self.reserves.get(&name).unwrap();
        require!(r.pending_amount.0 > 0, "renewal already reconciled");
        let (label, tla) = split(&name);
        view(
            &self.registry,
            "get_sub_account",
            json!({"tla_id":tla,"name":label}),
        )
        .then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(85))
                .on_renew_observed(name, r.pending_amount, r.pending_rent, operation),
        )
    }
    pub fn collect_refunds(&mut self) -> Promise {
        if self.phase == RenewalPhase::NeedsRefundConfirmation {
            self.phase = RenewalPhase::ConfirmingRefund;
            let name = self.renewing.clone().unwrap();
            let operation = U64(self.generation);
            return view(
                &self.registry,
                "get_pending_refund",
                json!({"account_id":env::current_account_id()}),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_refund_confirmed(name, operation),
            );
        }

        require!(
            self.phase == RenewalPhase::RefundReady,
            "refund not awaiting collection"
        );
        self.phase = RenewalPhase::QuotingRefund;
        let operation = U64(self.generation);
        let name = self.renewing.clone().unwrap();
        view(
            &self.registry,
            "get_pending_refund",
            json!({"account_id":env::current_account_id()}),
        )
        .then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(65))
                .on_refund_quoted(name, operation),
        )
    }
    #[private]
    pub fn on_refund_quoted(&mut self, name: AccountId, operation: U64) -> PromiseOrValue<bool> {
        self.assert_renewal(&name, operation, RenewalPhase::QuotingRefund);
        let Some(refund) = read::<U128>(0) else {
            self.phase = RenewalPhase::RefundReady;
            return PromiseOrValue::Value(false);
        };
        let r = self.reserves.get_mut(&name).unwrap();
        if refund.0 > r.pending_amount.0 {
            self.phase = RenewalPhase::RefundReady;
            return PromiseOrValue::Value(false);
        }
        r.owed_by_registry = refund;
        if refund.0 == 0 {
            self.finish_renewal(name);
            return PromiseOrValue::Value(true);
        }
        self.phase = RenewalPhase::Collecting;
        PromiseOrValue::Promise(
            call(
                &self.registry,
                "claim_refund",
                json!({}),
                NearToken::from_yoctonear(0),
                20,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(30))
                    .on_refunds_collected(name, operation),
            ),
        )
    }
    #[private]
    pub fn on_refunds_collected(
        &mut self,
        name: AccountId,
        operation: U64,
    ) -> PromiseOrValue<bool> {
        self.assert_renewal(&name, operation, RenewalPhase::Collecting);
        if !ok() {
            self.phase = RenewalPhase::RefundReady;
            return PromiseOrValue::Value(false);
        }
        self.phase = RenewalPhase::ConfirmingRefund;
        PromiseOrValue::Promise(
            view(
                &self.registry,
                "get_pending_refund",
                json!({"account_id":env::current_account_id()}),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_refund_confirmed(name, operation),
            ),
        )
    }
    #[private]
    pub fn on_refund_confirmed(&mut self, name: AccountId, operation: U64) -> bool {
        self.assert_renewal(&name, operation, RenewalPhase::ConfirmingRefund);
        match read::<U128>(0) {
            None => {
                self.phase = RenewalPhase::NeedsRefundConfirmation;
                return false;
            }
            Some(pending) if pending.0 > 0 => {
                self.phase = RenewalPhase::RefundReady;
                return false;
            }
            Some(_) => {}
        }
        self.finish_renewal(name);
        true
    }
    pub fn get_reserve(&self, name: AccountId) -> Option<Reserve> {
        self.reserves.get(&name).cloned()
    }
    pub fn due_soon(
        &self,
        from_index: Option<u32>,
        limit: Option<u32>,
        within_ns: Option<U64>,
    ) -> Vec<AccountId> {
        let window = within_ns.map_or(RENEW_WINDOW_NS, |n| n.0.min(RENEW_WINDOW_NS));
        self.reserves
            .iter()
            .filter(|(_, r)| {
                r.enabled && r.expires_at.0 <= env::block_timestamp().saturating_add(window)
            })
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .map(|(n, _)| n.clone())
            .collect()
    }
    pub fn config(&self) -> Value {
        json!({"registry":self.registry,"collector_setup_deposit":SETUP.as_yoctonear().to_string()})
    }
}
impl Keeper {
    fn finish_renewal(&mut self, name: AccountId) {
        let r = self.reserves.get_mut(&name).unwrap();
        let paid = r.pending_amount.0 - r.owed_by_registry.0;
        r.balance.0 += r.owed_by_registry.0;
        if paid > 0 {
            AttoEvent::Renewed {
                name: name.clone(),
                paid: U128(paid),
                new_expires_at: r.expires_at,
            }
            .emit();
        } else {
            AttoEvent::RenewFailed {
                name: name.clone(),
                attempted: r.pending_amount,
            }
            .emit();
        }
        r.owed_by_registry = U128(0);
        r.pending_amount = U128(0);
        r.pending_rent = U128(0);
        r.busy = false;
        self.renewing = None;
        self.phase = RenewalPhase::Idle;
    }
    fn assert_renewal(&self, name: &AccountId, operation: U64, phase: RenewalPhase) {
        require!(
            self.renewing.as_ref() == Some(name)
                && self.generation == operation.0
                && self.phase == phase,
            "stale renewal callback"
        );
    }
    fn ready_mut(&mut self, name: &AccountId) -> &mut Reserve {
        let r = self
            .reserves
            .get_mut(name)
            .unwrap_or_else(|| env::panic_str("prepare the name first"));
        require!(r.ready && !r.busy, "reserve busy or not ready");
        r
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, PromiseResult};
    fn awaiting_confirmation(result: PromiseResult) -> (Keeper, AccountId) {
        let keeper: AccountId = "keeper.near".parse().unwrap();
        let name: AccountId = "bakery.food".parse().unwrap();
        let context = VMContextBuilder::new()
            .current_account_id(keeper.clone())
            .predecessor_account_id(keeper)
            .build();
        #[allow(deprecated)]
        near_sdk::test_utils::testing_env_with_promise_results(context, result);
        let mut contract = Keeper::new("registry.near".parse().unwrap());
        contract.reserves.insert(
            name.clone(),
            Reserve {
                name: name.clone(),
                last_spent_seen: U128(0),
                balance: U128(90),
                enabled: true,
                share_bps: 500,
                puller: "bot.near".parse().unwrap(),
                collector: "collector.keeper.near".parse().unwrap(),
                ready: true,
                busy: true,
                expires_at: U64(1),
                owed_by_registry: U128(10),
                pending_amount: U128(20),
                pending_rent: U128(10),
            },
        );
        contract.renewing = Some(name.clone());
        contract.generation = 1;
        contract.phase = RenewalPhase::ConfirmingRefund;
        (contract, name)
    }
    #[test]
    fn restored_registry_refund_is_not_credited() {
        let (mut contract, name) =
            awaiting_confirmation(PromiseResult::Successful(b"\"10\"".to_vec()));
        assert!(!contract.on_refund_confirmed(name.clone(), U64(1)));
        let reserve = contract.reserves.get(&name).unwrap();
        assert_eq!(reserve.balance, U128(90));
        assert_eq!(reserve.owed_by_registry, U128(10));
        assert!(reserve.busy);
        assert!(contract.phase == RenewalPhase::RefundReady);
    }
    #[test]
    fn unreadable_confirmation_preserves_refund_for_retry() {
        let (mut contract, name) = awaiting_confirmation(PromiseResult::Failed);
        assert!(!contract.on_refund_confirmed(name.clone(), U64(1)));
        let reserve = contract.reserves.get(&name).unwrap();
        assert_eq!(reserve.balance, U128(90));
        assert_eq!(reserve.owed_by_registry, U128(10));
        assert!(reserve.busy);
        assert!(contract.phase == RenewalPhase::NeedsRefundConfirmation);
    }
}
