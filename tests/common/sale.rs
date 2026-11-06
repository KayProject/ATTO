use super::*;
use anyhow::Result;
use atto_shared::{to_hex, Manifest, NftRef, TokenAmount};
use base64::Engine;
use defuse_core::nep413::{Nep413, Nep413Payload};
use defuse_wallet::Request;
use ed25519_dalek::Signer;
use near_sdk::json_types::U128;
use near_sdk::NearToken as SdkToken;
use near_workspaces::types::NearToken;
use serde_json::{json, Value};

pub async fn run_sale(with_keeper: bool) -> Result<()> {
    let fleet = deploy_fleet().await?;
    let registry =
        deploy_registry_with_terms(&fleet, Some(10 * 24 * 3600 * 1_000_000_000), GRACE_NS).await?;
    let intents = deploy_intents(&fleet).await?;
    let escrow = deploy_atto(&fleet, "escrow", "atto_escrow", 20).await?;
    escrow.call("new").args_json(json!({"registry":registry.id(),"intents":intents.id(),"hos_extension":fleet.extension.id()})).transact().await?.into_result()?;
    let name = rent(&fleet, &registry, fleet.registrar.id(), "bakery").await?;
    let descendant = seed_descendant(&fleet, &name).await?;
    fleet
        .relay
        .transfer_near(&name, NearToken::from_near(2))
        .await?
        .into_result()?;
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
    let key = IntentsKey::random();
    let requests = [
        call_from_name(
            intents.id(),
            "add_public_key",
            json!({"public_key":key.public_key()}),
            SdkToken::from_yoctonear(1),
            30,
        ),
        call_from_name(
            nft.id(),
            "nft_approve",
            json!({"token_id":"art","account_id":fleet.bob.id()}),
            SdkToken::from_millinear(1),
            15,
        ),
    ];
    assert_clean(
        &owner_executes(&fleet.bob, &name, Request::new().external(requests), 150).await?,
        "dirty name setup",
    )?;
    let keeper = if with_keeper {
        let keeper = deploy_atto(&fleet, "keeper", "atto_keeper", 30).await?;
        keeper
            .call("new")
            .args_json(json!({"registry":registry.id()}))
            .transact()
            .await?
            .into_result()?;
        assert_clean(
            &fleet
                .bob
                .call(keeper.id(), "prepare")
                .args_json(json!({"name":name}))
                .deposit(NearToken::from_millinear(2100))
                .max_gas()
                .transact()
                .await?,
            "prepare collector",
        )?;
        let reserve: Value = keeper
            .view("get_reserve")
            .args_json(json!({"name":name}))
            .await?
            .json()?;
        assert_eq!(reserve["ready"], true, "{reserve}");
        let collector: near_workspaces::AccountId =
            reserve["collector"].as_str().unwrap().parse()?;
        assert!(fleet.worker.view_access_keys(&collector).await?.is_empty());
        let request = Request::new().internal([defuse_wallet::WalletOp::AddExtension {
            account_id: sdk_id(&collector),
        }]);
        assert_clean(
            &owner_executes(&fleet.bob, &name, request, 50).await?,
            "add collector",
        )?;
        let grant = json!({"extension":collector,"receivers":[collector],"budget_yocto":NearToken::from_near(1).as_yoctonear().to_string(),"tokens":[],"items":[],"expires_at":(chain_timestamp_ns(&fleet.worker).await?+YEAR_NS).to_string()});
        let config = call_from_name(
            keeper.id(),
            "configure",
            json!({"enabled":true,"share_bps":500,"puller":fleet.relay.id()}),
            SdkToken::from_yoctonear(0),
            20,
        );
        println!(
            "Keeper configure request: {}",
            serde_json::to_string(&Request::new().external([config.clone()]))?
        );
        assert_clean(
            &owner_executes(&fleet.bob, &name, Request::new().external([config]), 80).await?,
            "configure keeper",
        )?;
        assert_clean(
            &fleet
                .bob
                .call(&name, "hos_grant_spend")
                .args_json(grant.clone())
                .deposit(ONE_YOCTO)
                .max_gas()
                .transact()
                .await?,
            "grant capped collector spend",
        )?;
        assert_clean(&fleet.relay.call(keeper.id(),"pull").args_json(json!({"name":name,"amount":NearToken::from_millinear(100).as_yoctonear().to_string()})).max_gas().transact().await?,"pull within cap")?;
        assert_clean(
            &fleet
                .relay
                .call(keeper.id(), "sync")
                .args_json(json!({"name":name}))
                .max_gas()
                .transact()
                .await?,
            "credit received collector funds",
        )?;
        let reserve: Value = keeper
            .view("get_reserve")
            .args_json(json!({"name":name}))
            .await?
            .json()?;
        let mut received: u128 = reserve["balance"].as_str().unwrap().parse()?;
        assert!(received >= NearToken::from_millinear(100).as_yoctonear());
        let excess = fleet
            .relay
            .call(keeper.id(), "pull")
            .args_json(
                json!({"name":name,"amount":NearToken::from_near(2).as_yoctonear().to_string()}),
            )
            .max_gas()
            .transact()
            .await?;
        assert!(
            !excess.is_success() || !excess.receipt_failures().is_empty(),
            "wallet cap must refuse excess pull"
        );
        assert_clean(
            &fleet
                .bob
                .call(&name, "hos_revoke_spend")
                .args_json(json!({"extension":collector}))
                .deposit(ONE_YOCTO)
                .max_gas()
                .transact()
                .await?,
            "revoke spend",
        )?;
        assert_clean(
            &fleet
                .bob
                .call(&name, "hos_grant_spend")
                .args_json(grant)
                .deposit(ONE_YOCTO)
                .max_gas()
                .transact()
                .await?,
            "regrant spend after meter reset",
        )?;
        assert_clean(&fleet.relay.call(keeper.id(),"pull").args_json(json!({"name":name,"amount":NearToken::from_millinear(100).as_yoctonear().to_string()})).max_gas().transact().await?,"pull after regrant")?;
        assert_clean(
            &fleet
                .relay
                .call(keeper.id(), "sync")
                .args_json(json!({"name":name}))
                .max_gas()
                .transact()
                .await?,
            "sync actual receipts after meter reset",
        )?;
        let reserve: Value = keeper
            .view("get_reserve")
            .args_json(json!({"name":name}))
            .await?
            .json()?;
        let after_regrant: u128 = reserve["balance"].as_str().unwrap().parse()?;
        assert!(after_regrant >= received + NearToken::from_millinear(100).as_yoctonear());
        received = after_regrant;
        let unauthorized = fleet
            .bob
            .call(keeper.id(), "withdraw")
            .args_json(json!({"amount":"1"}))
            .max_gas()
            .transact()
            .await?;
        assert!(
            !unauthorized.is_success(),
            "only name may withdraw its reserve"
        );
        let withdrawal = call_from_name(
            keeper.id(),
            "withdraw",
            json!({"amount":"1"}),
            SdkToken::from_yoctonear(0),
            40,
        );
        assert_clean(
            &owner_executes(
                &fleet.bob,
                &name,
                Request::new().external([withdrawal]),
                100,
            )
            .await?,
            "name withdraws to itself",
        )?;
        let reserve: Value = keeper
            .view("get_reserve")
            .args_json(json!({"name":name}))
            .await?
            .json()?;
        assert_eq!(reserve["balance"], (received - 1).to_string());
        received -= 1;
        println!("PASS keeper: capped pull, cap refusal, revoke/regrant, name-only withdrawal");
        let rent: Value = registry
            .view("get_rent_price")
            .args_json(json!({"tla_id":fleet.registrar.id(),"name":"bakery"}))
            .await?
            .json()?;
        let rent: u128 = rent["rent_yocto"].as_str().unwrap().parse()?;
        fleet
            .relay
            .call(keeper.id(), "top_up")
            .args_json(json!({"name":name}))
            .deposit(NearToken::from_yoctonear(rent * 2))
            .transact()
            .await?
            .into_result()?;
        Some((keeper, rent, received))
    } else {
        None
    };
    let manifest = Manifest {
        token_id: name.to_string(),
        intents_keys: vec![key.public_key()],
        intents_floor: vec![TokenAmount {
            token_id: format!("nep141:{}", ft.id()),
            amount: U128(100),
        }],
        nfts: vec![NftRef {
            contract_id: nft.id().to_string(),
            token_id: "art".into(),
        }],
        needs_seller: vec![format!(
            "Pre-existing sub-account {descendant} retains a seller-held full-access key"
        )],
    };
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
    let payload = Nep413Payload::new(json!({"signer_id":name,"deadline":"2100-01-01T00:00:00.000Z","intents":[{"intent":"ft_withdraw","token":ft.id(),"receiver_id":fleet.bob.id(),"amount":"100"}]}).to_string()).recipient(intents.id().as_str()).nonce(nonce);
    let signature = key.key.sign(&Nep413::prehash(&payload));
    let signed = json!({"standard":"nep413","payload":{"message":payload.message,"nonce":base64::engine::general_purpose::STANDARD.encode(nonce),"recipient":payload.recipient},"public_key":key.public_key(),"signature":format!("ed25519:{}",bs58::encode(signature.to_bytes()).into_string())});
    let simulation = fleet
        .relay
        .call(intents.id(), "simulate_intents")
        .args_json(json!({"signed":[signed.clone()]}))
        .max_gas()
        .transact()
        .await?;
    assert_clean(&simulation, "old key signs a valid withdrawal before sale")?;
    let price = NearToken::from_near(3);
    let listing = fleet
        .bob
        .call(escrow.id(), "list")
        .args_json(json!({"token_id":name,"price":price.as_yoctonear().to_string()}))
        .deposit(NearToken::from_millinear(50))
        .max_gas()
        .transact()
        .await?;
    assert_clean(&listing, "list")?;
    let id: String = listing.json()?;
    assert_ne!(id, "0", "listing rejected");
    assert_clean(
        &fleet
            .relay
            .call(escrow.id(), "pay")
            .args_json(json!({"listing_id":id,"fingerprint":to_hex(&manifest.fingerprint())}))
            .deposit(price)
            .transact()
            .await?,
        "payment",
    )?;
    let revenue_before: Value = registry.view("get_stats").await?.json()?;
    let revenue_before: u128 = revenue_before["total_revenue_yocto"]
        .as_str()
        .unwrap()
        .parse()?;
    let handover=fleet.bob.call(registry.id(), "nft_transfer_call").args_json(json!({"receiver_id":escrow.id(),"token_id":name,"approval_id":null,"memo":null,"msg":id})).deposit(ONE_YOCTO).max_gas();
    if let Some((keeper, _, _)) = &keeper {
        let renewal = fleet
            .council
            .call(keeper.id(), "renew")
            .args_json(json!({"name":name}))
            .max_gas();
        let (handover, renewal) = tokio::join!(handover.transact(), renewal.transact());
        assert_clean(&handover?, "sale during renewal")?;
        assert_clean(&renewal?, "renewal during sale")?;
    } else {
        assert_clean(&handover.transact().await?, "handover")?;
    }

    assert_clean(
        &fleet
            .relay
            .call(escrow.id(), "post_manifest")
            .args_json(json!({"listing_id":id,"manifest":manifest}))
            .transact()
            .await?,
        "manifest",
    )?;
    assert_clean(
        &fleet
            .relay
            .call(escrow.id(), "clear")
            .args_json(json!({"listing_id":id,"count":10}))
            .deposit(NearToken::from_millinear(10))
            .max_gas()
            .transact()
            .await?,
        "clear",
    )?;
    assert!(intents_keys_of(&intents, &name).await?.is_empty());
    let art: Value = nft
        .view("nft_token")
        .args_json(json!({"token_id":"art"}))
        .await?
        .json()?;
    assert_eq!(art["approved_account_ids"], json!({}));
    assert_clean(
        &fleet
            .relay
            .call(escrow.id(), "verify")
            .args_json(json!({"listing_id":id}))
            .max_gas()
            .transact()
            .await?,
        "verify",
    )?;
    let listing: Value = escrow
        .view("get_listing")
        .args_json(json!({"listing_id":id}))
        .await?
        .json()?;
    assert_eq!(listing["state"], "Verified", "{listing}");
    let seller_before = balance_of(&fleet.worker, fleet.bob.id()).await?;
    assert_clean(
        &fleet
            .relay
            .call(escrow.id(), "complete")
            .args_json(json!({"listing_id":id}))
            .max_gas()
            .transact()
            .await?,
        "complete",
    )?;
    let listing: Value = escrow
        .view("get_listing")
        .args_json(json!({"listing_id":id}))
        .await?
        .json()?;
    assert_eq!(listing["state"], "Completed", "{listing}");
    assert_eq!(
        owner_account(&fleet.worker, &name, fleet.extension.id()).await?,
        fleet.relay.id().as_str()
    );
    assert_eq!(
        balance_of(&fleet.worker, fleet.bob.id()).await? - seller_before,
        price.as_yoctonear() + NearToken::from_millinear(50).as_yoctonear()
    );
    let old_key = fleet
        .relay
        .call(intents.id(), "execute_intents")
        .args_json(json!({"signed":[signed]}))
        .max_gas()
        .transact()
        .await?;
    assert!(
        !old_key.is_success() || !old_key.receipt_failures().is_empty(),
        "removed seller key must fail"
    );
    let balance: String = intents
        .view("mt_balance_of")
        .args_json(json!({"account_id":name,"token_id":format!("nep141:{}",ft.id())}))
        .await?
        .json()?;
    assert_eq!(balance, "100");
    if let Some((keeper, rent, received)) = keeper {
        let reserve: Value = keeper
            .view("get_reserve")
            .args_json(json!({"name":name}))
            .await?
            .json()?;
        assert_eq!(reserve["busy"], false, "{reserve}");
        assert_eq!(reserve["owed_by_registry"], "0", "{reserve}");
        let revenue_after: Value = registry.view("get_stats").await?.json()?;
        let revenue_after: u128 = revenue_after["total_revenue_yocto"]
            .as_str()
            .unwrap()
            .parse()?;
        let actual_rent = revenue_after - revenue_before;
        assert!(actual_rent > 0);
        assert_eq!(
            reserve["balance"],
            (2 * rent + received - actual_rent).to_string(),
            "renewal charges exactly rent after refund"
        );
        let sub: Value = registry
            .view("get_sub_account")
            .args_json(json!({"tla_id":fleet.registrar.id(),"name":"bakery"}))
            .await?
            .json()?;
        assert!(
            sub["expires_at"].as_str().unwrap().parse::<u64>()?
                > chain_timestamp_ns(&fleet.worker).await? + 15 * 24 * 3600 * 1_000_000_000
        );
        println!(
            "PASS sale mid-renewal: lease extended; reserve charged exact rent; buyer owns name"
        );
    }
    let descendant_keys = fleet.worker.view_access_keys(&descendant).await?;
    assert!(
        descendant_keys
            .iter()
            .any(|k| k.public_key == fleet.bob.secret_key().public_key()),
        "seller-held descendant key must remain a disclosed limitation"
    );
    println!("PASS disclosed descendant: {descendant} retains its seller-held key; accepted manifest records this");
    println!(
        "PASS dirty sale: buyer owns {name}; seller paid; Intents keys empty; NFT approvals empty"
    );
    Ok(())
}
