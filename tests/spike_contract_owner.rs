//! A-03: a contract can own a leased name and make it call NEAR Intents.
//! The escrow depends on this: it must remove the seller's Intents keys
//! while it owns the name.

mod common;

use anyhow::Result;
use common::*;
use defuse_wallet::Request;
use near_sdk::NearToken as SdkToken;
use near_workspaces::types::NearToken;

#[tokio::test]
async fn a_contract_owner_can_add_and_remove_intents_keys_for_a_name() -> Result<()> {
    let fleet = deploy_fleet().await?;
    let registry = deploy_registry(&fleet).await?;
    let tla = fleet.registrar.id().clone();
    let intents = deploy_intents(&fleet).await?;
    let driver = deploy_atto(&fleet, "driver", "atto_driver", 10).await?;

    let label = "bakery";
    let name = rent(&fleet, &registry, &tla, label).await?;
    let token_id = name.to_string();
    fleet.relay.transfer_near(&name, NearToken::from_near(1)).await?.into_result()?;

    // The seller, a person, registers a key for the name inside Intents.
    let seller_key = IntentsKey::random();
    let add = call_from_name(
        intents.id(),
        "add_public_key",
        serde_json::json!({ "public_key": seller_key.public_key() }),
        SdkToken::from_yoctonear(1),
        30,
    );
    let out = owner_executes(&fleet.bob, &name, Request::new().external([add]), 100).await?;
    assert_clean(&out, "seller adds intents key")?;
    assert_eq!(intents_keys_of(&intents, &name).await?, vec![seller_key.public_key()]);
    println!("seller key registered for {name}: {}", seller_key.public_key());

    // The name moves to the driver contract.
    let out = transfer_name(&fleet.bob, &registry, &token_id, driver.id()).await?;
    assert_clean(&out, "transfer to contract")?;
    assert_eq!(
        owner_account(&fleet.worker, &name, fleet.extension.id()).await?,
        driver.id().as_str(),
        "the contract must now own the name"
    );

    // The handover swept the name's NEAR to the seller, so it cannot pay the
    // 1 yocto each Intents call needs. The new owner tops it up first.
    fleet.relay.transfer_near(&name, NearToken::from_millinear(50)).await?.into_result()?;

    // The contract makes the name add a key of its own, then remove both.
    let own_key = IntentsKey::random();
    let add_own = call_from_name(
        intents.id(),
        "add_public_key",
        serde_json::json!({ "public_key": own_key.public_key() }),
        SdkToken::from_yoctonear(1),
        30,
    );
    let out = driver
        .call("drive")
        .args_json(serde_json::json!({ "name": name, "request": Request::new().external([add_own]), "tgas": 100 }))
        .max_gas()
        .transact()
        .await?;
    assert_clean(&out, "contract adds key through the name")?;
    let mut keys = intents_keys_of(&intents, &name).await?;
    keys.sort();
    let mut expected = vec![seller_key.public_key(), own_key.public_key()];
    expected.sort();
    assert_eq!(keys, expected);

    let removals = [seller_key.public_key(), own_key.public_key()].map(|k| {
        call_from_name(
            intents.id(),
            "remove_public_key",
            serde_json::json!({ "public_key": k }),
            SdkToken::from_yoctonear(1),
            30,
        )
    });
    let out = driver
        .call("drive")
        .args_json(serde_json::json!({ "name": name, "request": Request::new().external(removals), "tgas": 150 }))
        .max_gas()
        .transact()
        .await?;
    assert_clean(&out, "contract removes keys through the name")?;
    println!("gas burnt for removing 2 keys: {} Tgas", out.total_gas_burnt.as_tgas());

    assert!(intents_keys_of(&intents, &name).await?.is_empty(), "no keys may remain");
    println!("PASS: contract-owned name removed every Intents key; keys now []");
    Ok(())
}
