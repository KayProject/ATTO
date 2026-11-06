mod common;
use anyhow::Result;
use base64::Engine;
use common::*;
use defuse_core::nep413::{Nep413, Nep413Payload};
use ed25519_dalek::Signer;
use near_workspaces::types::NearToken;
use serde_json::json;

#[tokio::test]
#[ignore]
async fn deploy_keyless_sandbox() -> Result<()> {
    let fleet = deploy_fleet().await?;
    let registry =
        deploy_registry_with_terms(&fleet, Some(10 * 24 * 3600 * 1_000_000_000), GRACE_NS).await?;
    let intents = deploy_intents(&fleet).await?;
    let escrow = deploy_atto(&fleet, "escrow", "atto_escrow", 30).await?;
    escrow.call("new").args_json(json!({"registry":registry.id(),"intents":intents.id(),"hos_extension":fleet.extension.id()})).transact().await?.into_result()?;
    escrow
        .as_account()
        .batch(escrow.id())
        .delete_key(escrow.as_account().secret_key().public_key())
        .transact()
        .await?
        .into_result()?;
    assert!(escrow.view_access_keys().await?.is_empty());
    let keeper = deploy_atto(&fleet, "keeper", "atto_keeper", 30).await?;
    keeper
        .call("new")
        .args_json(json!({"registry":registry.id()}))
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
    assert!(keeper.view_access_keys().await?.is_empty());
    let name = rent(&fleet, &registry, fleet.registrar.id(), "bakery").await?;
    fleet
        .relay
        .transfer_near(&name, NearToken::from_near(2))
        .await?
        .into_result()?;
    let descendant = seed_descendant(&fleet, &name).await?;
    let nft = deploy_atto(&fleet, "art", "atto_test_nft", 5).await?;
    nft.call("new")
        .args_json(json!({"owner":name}))
        .transact()
        .await?
        .into_result()?;
    let ft_account = funded(&fleet, "coin", 5).await?;
    let ft = ft_account.deploy(&wasm("test_ft")).await?.into_result()?;
    ft.call("new")
        .args_json(json!({"owner":fleet.bob.id(),"total_supply":"1000000"}))
        .transact()
        .await?
        .into_result()?;
    for who in [intents.id(), &name] {
        fleet
            .bob
            .call(ft.id(), "storage_deposit")
            .args_json(json!({"account_id":who}))
            .deposit(NearToken::from_millinear(10))
            .transact()
            .await?
            .into_result()?;
    }
    fleet
        .bob
        .call(ft.id(), "ft_transfer_call")
        .args_json(
            json!({"receiver_id":intents.id(),"amount":"100","memo":null,"msg":name.to_string()}),
        )
        .deposit(ONE_YOCTO)
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    let approve = call_from_name(
        nft.id(),
        "nft_approve",
        json!({"token_id":"art","account_id":fleet.bob.id()}),
        near_sdk::NearToken::from_millinear(1),
        20,
    );
    assert_clean(
        &owner_executes(
            &fleet.bob,
            &name,
            defuse_wallet::Request::new().external([approve]),
            80,
        )
        .await?,
        "seed NFT approval",
    )?;
    let key = IntentsKey::random();
    let add = call_from_name(
        intents.id(),
        "add_public_key",
        json!({"public_key":key.public_key()}),
        near_sdk::NearToken::from_yoctonear(1),
        30,
    );
    assert_clean(
        &owner_executes(
            &fleet.bob,
            &name,
            defuse_wallet::Request::new().external([add]),
            100,
        )
        .await?,
        "seed dirty demo name",
    )?;
    let mut nonce = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut nonce);
    if let Ok(salt) = intents.view("current_salt").await {
        let salt: String = salt.json()?;
        nonce[..5].copy_from_slice(&[0x56, 0x28, 0xf6, 0xc6, 0]);
        for i in 0..4 {
            nonce[5 + i] = u8::from_str_radix(&salt[i * 2..i * 2 + 2], 16)?;
        }
        nonce[9..17].copy_from_slice(&4_102_444_800_000_000_000i64.to_le_bytes());
    }
    let payload=Nep413Payload::new(json!({"signer_id":name,"deadline":"2100-01-01T00:00:00.000Z","intents":[{"intent":"ft_withdraw","token":ft.id(),"receiver_id":fleet.bob.id(),"amount":"100"}]}).to_string()).recipient(intents.id().as_str()).nonce(nonce);
    let signature = key.key.sign(&Nep413::prehash(&payload));
    let signed_withdrawal = json!({"standard":"nep413","payload":{"message":payload.message,"nonce":base64::engine::general_purpose::STANDARD.encode(nonce),"recipient":payload.recipient},"public_key":key.public_key(),"signature":format!("ed25519:{}",bs58::encode(signature.to_bytes()).into_string())});
    assert_clean(
        &fleet
            .relay
            .call(intents.id(), "simulate_intents")
            .args_json(json!({"signed":[signed_withdrawal.clone()]}))
            .max_gas()
            .transact()
            .await?,
        "pre-sale withdrawal validity",
    )?;
    assert_clean(
        &fleet
            .relay
            .call(keeper.id(), "prepare")
            .args_json(json!({"name":name}))
            .deposit(NearToken::from_millinear(2100))
            .max_gas()
            .transact()
            .await?,
        "prepare keyless demo collector",
    )?;
    let reserve: serde_json::Value = keeper
        .view("get_reserve")
        .args_json(json!({"name":name}))
        .await?
        .json()?;
    assert_eq!(reserve["ready"], true);
    let collector: near_workspaces::AccountId = reserve["collector"].as_str().unwrap().parse()?;
    assert!(fleet.worker.view_access_keys(&collector).await?.is_empty());
    let output = std::path::Path::new("../workbench/sandbox");
    std::fs::create_dir_all(output)?;
    let config = json!({"network":"sandbox","rpcUrl":fleet.worker.rpc_addr(),"registry":registry.id(),"intents":intents.id(),"hosExtension":fleet.extension.id(),"escrow":escrow.id(),"keeper":keeper.id(),"collector":collector,"seller":fleet.bob.id(),"buyer":fleet.relay.id(),"bot":fleet.relay.id(),"name":name});
    std::fs::write(
        output.join("runtime.json"),
        serde_json::to_vec_pretty(&config)?,
    )?;
    let manifest = json!({"token_id":name,"intents_keys":[key.public_key()],"intents_floor":[{"token_id":format!("nep141:{}",ft.id()),"amount":"100"}],"nfts":[{"contract_id":nft.id(),"token_id":"art"}],"needs_seller":[format!("Pre-existing sub-account {descendant} retains a seller-held full-access key")]});
    let block = fleet.worker.view_block().await?;
    let fixture = json!({"name":name,"network":"sandbox","scope":"Inventory of the contracts created by tests/deploy_sandbox.rs. The descendant is seeded sandbox pre-existing state, not created through the current wallet.","createdHeight":block.height(),"recordedAtNs":block.timestamp().to_string(),"completeWithinFixture":true,"intentsTokens":[{"contractId":ft.id(),"tokenId":format!("nep141:{}",ft.id()),"amount":"100"}],"nfts":[{"contract_id":nft.id(),"token_id":"art"}],"subaccounts":[{"accountId":descendant,"sellerHeldKey":fleet.bob.secret_key().public_key().to_string(),"provenance":"sandbox-seeded pre-existing state"}],"daoRoles":[],"externalContracts":[intents.id(),ft.id(),nft.id()],"manifest":manifest,"signedWithdrawal":signed_withdrawal,"withdrawalSimulatedBeforeSale":true});
    std::fs::write(
        output.join("fixture.json"),
        serde_json::to_vec_pretty(&fixture)?,
    )?;
    let credentials = json!({"seller":{"accountId":fleet.bob.id(),"secretKey":fleet.bob.secret_key().to_string()},"buyer":{"accountId":fleet.relay.id(),"secretKey":fleet.relay.secret_key().to_string()},"bot":{"accountId":fleet.relay.id(),"secretKey":fleet.relay.secret_key().to_string()}});
    std::fs::write(
        output.join("credentials.json"),
        serde_json::to_vec_pretty(&credentials)?,
    )?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            output.join("credentials.json"),
            std::fs::Permissions::from_mode(0o600),
        )?;
    }
    println!(
        "Sandbox ready; runtime config: workbench/sandbox/runtime.json; escrow access keys: []"
    );
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
    }
}
