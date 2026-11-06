//! Test-only contract: owns a leased name and forwards a wallet request to it.
//! Proves a contract (not a person) can drive a name through `w_execute_extension`.

use near_sdk::serde_json::{json, Value};
use near_sdk::{env, near, AccountId, Gas, NearToken, Promise};

#[near(contract_state)]
#[derive(Default)]
pub struct Driver {}

#[near]
impl Driver {
    pub fn drive(&mut self, name: AccountId, request: Value, tgas: u64) -> Promise {
        let args = json!({ "request": request }).to_string().into_bytes();
        Promise::new(name).function_call(
            "w_execute_extension".to_string(),
            args,
            NearToken::from_yoctonear(1),
            Gas::from_tgas(tgas),
        )
    }

    pub fn whoami(&self) -> AccountId {
        env::current_account_id()
    }
}
