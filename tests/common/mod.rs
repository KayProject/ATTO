#![allow(dead_code)]

pub mod registry;

use anyhow::{bail, Result};
use defuse_wallet::actions::FunctionCall;
use defuse_wallet::{NearPromise, Request};
use ed25519_dalek::SigningKey;
use near_sdk::{Gas as SdkGas, NearToken as SdkToken};
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, AccountId, Contract};
use serde_json::json;

pub use registry::*;

pub const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

/// The deployed NEAR Intents code, fetched from mainnet by `setup.sh`.
pub fn intents_wasm() -> Vec<u8> {
    std::fs::read("target/deps/intents.wasm").expect("run tests/setup.sh first")
}

/// One of ATTO's contracts, built by `setup.sh`.
pub fn atto_wasm(name: &str) -> Vec<u8> {
    let path = format!("../contracts/target/near/{name}/{name}.wasm");
    std::fs::read(&path).unwrap_or_else(|e| panic!("read {path}: {e}; run tests/setup.sh"))
}

pub async fn funded(fleet: &Fleet, name: &str, near: u128) -> Result<Account> {
    Ok(fleet
        .worker
        .root_account()?
        .create_subaccount(name)
        .initial_balance(NearToken::from_near(near))
        .transact()
        .await?
        .into_result()?)
}

pub async fn deploy_intents(fleet: &Fleet) -> Result<Contract> {
    let account = funded(fleet, "intents", 30).await?;
    let intents = account.deploy(&intents_wasm()).await?.into_result()?;
    intents
        .call("new")
        .args_json(json!({ "config": {
            "wnear_id": "wrap.test.near",
            "fees": { "fee": 0, "fee_collector": fleet.council.id() },
            "roles": { "super_admins": [fleet.council.id()], "admins": {}, "grantees": {} },
        }}))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    Ok(intents)
}

pub async fn deploy_atto(fleet: &Fleet, account: &str, wasm: &str, near: u128) -> Result<Contract> {
    let acc = funded(fleet, account, near).await?;
    Ok(acc.deploy(&atto_wasm(wasm)).await?.into_result()?)
}

pub fn sdk_id(id: &AccountId) -> near_sdk::AccountId {
    id.as_str().parse().unwrap()
}

/// A function call the name makes in its own name.
pub fn call_from_name(
    to: &AccountId,
    method: &str,
    args: serde_json::Value,
    deposit: SdkToken,
    tgas: u64,
) -> NearPromise {
    NearPromise::new(sdk_id(to)).function_call(
        FunctionCall::name(method)
            .args(serde_json::to_vec(&args).unwrap())
            .gas(SdkGas::from_tgas(tgas))
            .attach_deposit(deposit),
    )
}

/// The owner drives the name through the standard extension entrypoint.
pub async fn owner_executes(
    owner: &Account,
    name: &AccountId,
    request: Request,
    tgas: u64,
) -> Result<ExecutionFinalResult> {
    Ok(owner
        .call(name, "w_execute_extension")
        .args_json(json!({ "request": request }))
        .deposit(ONE_YOCTO)
        .gas(near_workspaces::types::Gas::from_tgas(tgas))
        .transact()
        .await?)
}

pub fn assert_clean(outcome: &ExecutionFinalResult, what: &str) -> Result<()> {
    if !outcome.is_success() {
        bail!("{what} failed: {outcome:#?}");
    }
    if let Some(failure) = outcome.receipt_failures().first() {
        bail!("{what} had a failed receipt: {failure:#?}");
    }
    Ok(())
}

/// An ed25519 key someone might register for a name inside Intents.
pub struct IntentsKey {
    pub key: SigningKey,
}

impl IntentsKey {
    pub fn random() -> Self {
        Self {
            key: SigningKey::generate(&mut rand::rngs::OsRng),
        }
    }

    pub fn public_key(&self) -> String {
        format!(
            "ed25519:{}",
            bs58::encode(self.key.verifying_key().to_bytes()).into_string()
        )
    }
}

pub async fn intents_keys_of(intents: &Contract, who: &AccountId) -> Result<Vec<String>> {
    Ok(intents
        .view("public_keys_of")
        .args_json(json!({ "account_id": who }))
        .await?
        .json()?)
}

/// Sends the name from its current owner to `to` with a plain `nft_transfer`.
pub async fn transfer_name(
    owner: &Account,
    registry: &Contract,
    token_id: &str,
    to: &AccountId,
) -> Result<ExecutionFinalResult> {
    Ok(owner
        .call(registry.id(), "nft_transfer")
        .args_json(
            json!({ "receiver_id": to, "token_id": token_id, "approval_id": null, "memo": null }),
        )
        .deposit(ONE_YOCTO)
        .max_gas()
        .transact()
        .await?)
}

pub mod sale;

/// Seeds a pre-existing descendant with a seller-held key; this is sandbox state,
/// not a claim that the current wallet exposes a create-account operation.
pub async fn seed_descendant(fleet: &Fleet, name: &AccountId) -> Result<AccountId> {
    let child: AccountId = format!("shop.{name}").parse()?;
    fleet
        .worker
        .patch(&child)
        .account(near_workspaces::AccountDetailsPatch::default().balance(NearToken::from_near(1)))
        .access_key(
            fleet.bob.secret_key().public_key(),
            near_workspaces::AccessKey::full_access(),
        )
        .transact()
        .await?;
    Ok(child)
}
