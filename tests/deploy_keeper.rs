mod common;
use anyhow::Result;
use near_workspaces::{
    network::ValidatorKey,
    types::{NearToken, SecretKey},
    AccountId,
};
use serde_json::{json, Value};

#[tokio::test]
#[ignore]
async fn deploy_keeper_to_running_sandbox() -> Result<()> {
    let folder = std::path::Path::new("../workbench/sandbox");
    let mut config: Value = serde_json::from_slice(&std::fs::read(folder.join("runtime.json"))?)?;
    let credentials: Value =
        serde_json::from_slice(&std::fs::read(folder.join("credentials.json"))?)?;
    anyhow::ensure!(config["network"] == "sandbox", "sandbox only");
    let rpc = config["rpcUrl"].as_str().unwrap();
    anyhow::ensure!(rpc.starts_with("http://127.0.0.1:"), "loopback only");
    let seller_id: AccountId = credentials["seller"]["accountId"]
        .as_str()
        .unwrap()
        .parse()?;
    let key: SecretKey = credentials["seller"]["secretKey"]
        .as_str()
        .unwrap()
        .parse()?;
    let worker = near_workspaces::sandbox()
        .rpc_addr(rpc)
        .validator_key(ValidatorKey::Known(seller_id.clone(), key.clone()))
        .await?;
    let seller = near_workspaces::Account::from_secret_key(seller_id, key, &worker);
    let account = seller
        .create_subaccount(&std::env::var("ATTO_KEEPER_LABEL").unwrap_or_else(|_| "keeper".into()))
        .initial_balance(NearToken::from_near(20))
        .transact()
        .await?
        .into_result()?;
    let keeper = account
        .deploy(&common::atto_wasm("atto_keeper"))
        .await?
        .into_result()?;
    keeper
        .call("new")
        .args_json(json!({"registry":config["registry"]}))
        .transact()
        .await?
        .into_result()?;
    keeper
        .as_account()
        .batch(keeper.id())
        .delete_key(keeper.as_account().secret_key().public_key())
        .transact()
        .await?
        .into_result()?;
    anyhow::ensure!(
        keeper.view_access_keys().await?.is_empty(),
        "keeper must have no keys"
    );
    common::assert_clean(
        &seller
            .call(keeper.id(), "prepare")
            .args_json(json!({"name":config["name"]}))
            .deposit(NearToken::from_millinear(2100))
            .max_gas()
            .transact()
            .await?,
        "prepare replacement keeper collector",
    )?;
    let reserve: Value = keeper
        .view("get_reserve")
        .args_json(json!({"name":config["name"]}))
        .await?
        .json()?;
    anyhow::ensure!(reserve["ready"] == true, "collector not ready");
    let collector: AccountId = reserve["collector"].as_str().unwrap().parse()?;
    anyhow::ensure!(
        worker.view_access_keys(&collector).await?.is_empty(),
        "collector must have no keys"
    );
    config["keeper"] = json!(keeper.id());
    config["collector"] = json!(collector);
    std::fs::write(
        folder.join("runtime.json"),
        serde_json::to_vec_pretty(&config)?,
    )?;
    println!("Running sandbox Keeper refreshed; Keeper and collector access keys: []");
    Ok(())
}
