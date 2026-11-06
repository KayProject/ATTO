use defuse_wallet::{NearPromise, Request};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};

const FLOAT: NearToken = NearToken::from_near(2);
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Collector {
    keeper: AccountId,
    name: AccountId,
    busy: bool,
}
#[near]
impl Collector {
    #[init]
    pub fn new(keeper: AccountId, name: AccountId) -> Self {
        require!(
            env::predecessor_account_id() == keeper,
            "only keeper initializes"
        );
        Self {
            keeper,
            name,
            busy: false,
        }
    }
    #[payable]
    pub fn pull(&mut self, amount: U128) -> Promise {
        require!(env::predecessor_account_id() == self.keeper, "only keeper");
        let request = Request::new().external([NearPromise::new(env::current_account_id())
            .transfer(NearToken::from_yoctonear(amount.0))]);
        Promise::new(self.name.clone()).function_call(
            "w_execute_extension",
            json!({"request":request}).to_string().into_bytes(),
            NearToken::from_yoctonear(1),
            Gas::from_tgas(40),
        )
    }
    pub fn sync(&mut self) -> Promise {
        require!(!self.busy, "sync in progress");
        let amount = env::account_balance().saturating_sub(FLOAT);
        require!(amount.as_yoctonear() > 0, "no received funds to sync");
        self.busy = true;
        Promise::new(self.keeper.clone())
            .function_call(
                "credit_collector",
                json!({"name":self.name}).to_string().into_bytes(),
                amount,
                Gas::from_tgas(15),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(5))
                    .on_synced(),
            )
    }
    #[private]
    pub fn on_synced(&mut self) {
        self.busy = false;
    }
}
