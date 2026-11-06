use near_sdk::serde_json::{json, Value};
use near_sdk::{env, near, require, AccountId, PanicOnDefault};
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TestNft {
    owner: AccountId,
    approved: Option<AccountId>,
}
#[near]
impl TestNft {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            approved: None,
        }
    }
    #[payable]
    pub fn nft_approve(&mut self, token_id: String, account_id: AccountId) {
        require!(
            token_id == "art" && env::predecessor_account_id() == self.owner,
            "only token owner"
        );
        self.approved = Some(account_id);
    }
    #[payable]
    pub fn nft_revoke_all(&mut self, token_id: String) {
        require!(
            token_id == "art" && env::predecessor_account_id() == self.owner,
            "only token owner"
        );
        self.approved = None;
    }
    pub fn nft_token(&self, token_id: String) -> Option<Value> {
        if token_id != "art" {
            return None;
        }
        let mut approvals = near_sdk::serde_json::Map::new();
        if let Some(account) = &self.approved {
            approvals.insert(account.to_string(), json!(0));
        }
        Some(
            json!({"token_id": token_id, "owner_id": self.owner, "approved_account_ids": approvals}),
        )
    }
}
