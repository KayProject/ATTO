//! NEP-297 events, standard `atto`, version `1.0.0`. Logged as
//! `EVENT_JSON:{"standard":"atto","version":"1.0.0","event":"<name>","data":{...}}`.

use near_sdk::json_types::{U128, U64};
use near_sdk::{near, AccountId};

use crate::NftRef;

#[near(event_json(standard = "atto"))]
#[derive(Debug, Clone, PartialEq)]
pub enum AttoEvent {
    // Escrow
    #[event_version("1.0.0")]
    Listed { listing_id: U64, token_id: String, seller: AccountId, price: U128 },
    #[event_version("1.0.0")]
    Paid { listing_id: U64, token_id: String, buyer: AccountId, price: U128, fingerprint: String },
    #[event_version("1.0.0")]
    NameReceived { listing_id: U64, token_id: String },
    #[event_version("1.0.0")]
    ManifestPosted { listing_id: U64, token_id: String, fingerprint: String, accepted_by_buyer: bool },
    #[event_version("1.0.0")]
    Cleared { listing_id: U64, token_id: String, keys_removed: Vec<String>, nfts_revoked: Vec<NftRef> },
    #[event_version("1.0.0")]
    Verified { listing_id: U64, token_id: String },
    #[event_version("1.0.0")]
    CheckFailed { listing_id: U64, token_id: String, reason: String },
    #[event_version("1.0.0")]
    Completed { listing_id: U64, token_id: String, seller: AccountId, buyer: AccountId, price: U128 },
    #[event_version("1.0.0")]
    Reversed { listing_id: U64, token_id: String, reason: String },
    #[event_version("1.0.0")]
    Cancelled { listing_id: U64, token_id: String, refunded: Option<AccountId> },

    // Keeper
    #[event_version("1.0.0")]
    Configured { name: AccountId, enabled: bool, share_bps: u16, puller: AccountId },
    #[event_version("1.0.0")]
    ToppedUp { name: AccountId, by: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    Pulled { name: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    Renewed { name: AccountId, paid: U128, new_expires_at: U64 },
    #[event_version("1.0.0")]
    RenewFailed { name: AccountId, attempted: U128 },
    #[event_version("1.0.0")]
    Withdrawn { name: AccountId, amount: U128 },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_shape() {
        let e = AttoEvent::NameReceived { listing_id: U64(3), token_id: "bakery.food".into() };
        assert_eq!(
            e.to_json().to_string(),
            r#"{"standard":"atto","version":"1.0.0","event":"name_received","data":{"listing_id":"3","token_id":"bakery.food"}}"#
        );
    }
}
