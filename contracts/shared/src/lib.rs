//! Types shared by the ATTO contracts and mirrored in `packages/shared`.
//! Changing anything here means changing the TypeScript copy and the test
//! vectors in the same commit.

use near_sdk::json_types::U128;
use near_sdk::near;

pub mod accounts;
pub mod events;

/// What the escrow clears and checks for one sale. The buyer accepts its
/// fingerprint when paying.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Manifest {
    /// The name being sold, e.g. `bakery.food`. Binds the manifest to one name.
    pub token_id: String,
    /// NEAR Intents public keys registered for the name, as `ed25519:<base58>`.
    pub intents_keys: Vec<String>,
    /// Intents balances the buyer was shown. `verify` requires at least these.
    pub intents_floor: Vec<TokenAmount>,
    /// NFTs the name holds whose approvals are revoked.
    pub nfts: Vec<NftRef>,
    /// Items only the seller or a third party can fix, accepted as they are.
    pub needs_seller: Vec<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TokenAmount {
    /// Intents token id, e.g. `nep141:wrap.near`.
    pub token_id: String,
    pub amount: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NftRef {
    pub contract_id: String,
    pub token_id: String,
}

impl Manifest {
    /// The Borsh bytes that the fingerprint is taken over.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        near_sdk::borsh::to_vec(self).expect("manifest serializes")
    }

    /// `sha256(borsh(manifest))`.
    pub fn fingerprint(&self) -> [u8; 32] {
        near_sdk::env::sha256_array(self.canonical_bytes())
    }
}

/// Lowercase hex, the form fingerprints take in JSON.
pub fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[(b >> 4) as usize] as char);
        out.push(DIGITS[(b & 0x0f) as usize] as char);
    }
    out
}

/// Parses a 64-character lowercase hex fingerprint.
pub fn from_hex(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, chunk) in s.as_bytes().chunks(2).enumerate() {
        let hi = (chunk[0] as char).to_digit(16)?;
        let lo = (chunk[1] as char).to_digit(16)?;
        out[i] = (hi * 16 + lo) as u8;
    }
    Some(out)
}

/// The states of a Clean Sale listing.
///
/// ```text
/// Listed --pay--> Paid --name arrives--> NameHeld --post_manifest--> Clearing
///   |              |                                                   |
///  delist      cancel / reclaim_payment                        clear, verify
///   v              v                                                   v
/// Cancelled    Cancelled                       Verified --complete--> Completed
///                                   (any check fails, or timeout) --reverse--> Reversed
/// ```
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ListingState {
    Listed,
    Paid,
    NameHeld,
    Clearing,
    Verified,
    Completed,
    Reversed,
    Cancelled,
}

/// A rating on one line of a Title Search report.
#[near(serializers = [json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rating {
    Clean,
    WillBeCleared,
    NeedsSeller,
}

/// How long a listing's lease must outlast the sale, in nanoseconds (72 hours).
pub const SALE_WINDOW_NS: u64 = 72 * 3600 * 1_000_000_000;
/// How long after paying a buyer may reclaim payment if the name never arrived (48 hours).
pub const RECLAIM_AFTER_NS: u64 = 48 * 3600 * 1_000_000_000;
/// How long after the name arrives anyone may reverse a sale that never verified (24 hours).
pub const CLEARING_TIMEOUT_NS: u64 = 24 * 3600 * 1_000_000_000;
/// Keeper renews only inside this window before lease end (30 days).
pub const RENEW_WINDOW_NS: u64 = 30 * 24 * 3600 * 1_000_000_000;
/// Keeper attaches rent plus this margin, in basis points.
pub const RENEW_MARGIN_BPS: u128 = 50;

#[cfg(test)]
mod tests {
    use super::*;

    pub fn vectors() -> Vec<(&'static str, Manifest)> {
        vec![
            (
                "empty",
                Manifest {
                    token_id: "clean.pay".into(),
                    intents_keys: vec![],
                    intents_floor: vec![],
                    nfts: vec![],
                    needs_seller: vec![],
                },
            ),
            (
                "dirty",
                Manifest {
                    token_id: "bakery.food".into(),
                    intents_keys: vec![
                        "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp".into(),
                    ],
                    intents_floor: vec![TokenAmount {
                        token_id: "nep141:wrap.near".into(),
                        amount: U128(2_500_000_000_000_000_000_000_000),
                    }],
                    nfts: vec![NftRef {
                        contract_id: "art.near".into(),
                        token_id: "17".into(),
                    }],
                    needs_seller: vec!["sub-account shop.bakery.food has 1 access key".into()],
                },
            ),
            (
                "many",
                Manifest {
                    token_id: "near.pay".into(),
                    intents_keys: vec![
                        "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp".into(),
                        "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847".into(),
                    ],
                    intents_floor: vec![
                        TokenAmount {
                            token_id: "nep141:wrap.near".into(),
                            amount: U128(1),
                        },
                        TokenAmount {
                            token_id: "nep141:usdc.near".into(),
                            amount: U128(u128::MAX),
                        },
                    ],
                    nfts: vec![
                        NftRef {
                            contract_id: "art.near".into(),
                            token_id: "1".into(),
                        },
                        NftRef {
                            contract_id: "x.paras.near".into(),
                            token_id: "99:1".into(),
                        },
                    ],
                    needs_seller: vec!["DAO role council in a.sputnik-dao.near".into(), "".into()],
                },
            ),
        ]
    }

    #[test]
    fn vectors_match_the_committed_file() {
        let committed: serde_json::Value = serde_json::from_str(include_str!(
            "../../../packages/shared/vectors/manifest.json"
        ))
        .unwrap();
        for (name, manifest) in vectors() {
            let entry = &committed[name];
            let json = serde_json::to_value(&manifest).unwrap();
            assert_eq!(entry["manifest"], json, "{name}: manifest JSON differs");
            assert_eq!(
                entry["borsh_hex"].as_str().unwrap(),
                hex::encode(manifest.canonical_bytes()),
                "{name}: borsh bytes differ"
            );
            assert_eq!(
                entry["fingerprint"].as_str().unwrap(),
                to_hex(&manifest.fingerprint()),
                "{name}: fingerprint differs"
            );
        }
    }

    #[test]
    #[ignore]
    fn print_vectors() {
        let mut out = serde_json::Map::new();
        for (name, manifest) in vectors() {
            out.insert(
                name.into(),
                serde_json::json!({
                    "manifest": manifest,
                    "borsh_hex": hex::encode(manifest.canonical_bytes()),
                    "fingerprint": to_hex(&manifest.fingerprint()),
                }),
            );
        }
        println!("{}", serde_json::to_string_pretty(&out).unwrap());
    }

    #[test]
    fn hex_round_trips() {
        let fp = vectors()[1].1.fingerprint();
        assert_eq!(from_hex(&to_hex(&fp)), Some(fp));
        assert_eq!(from_hex("zz"), None);
    }
}
