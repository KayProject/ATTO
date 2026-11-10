//! Account names ATTO talks to, per network. Read on chain on 2026-11-06.
//! Sandbox names are assigned by the test harness at run time.

pub struct Network {
    pub registry: &'static str,
    pub hos_extension: &'static str,
    pub intents: &'static str,
    /// Set once the escrow is deployed.
    pub escrow: Option<&'static str>,
    /// Set once the Keeper is deployed.
    pub keeper: Option<&'static str>,
}

pub const MAINNET: Network = Network {
    registry: "registry.hos",
    hos_extension: "ext.hos",
    intents: "intents.near",
    escrow: Some("escrow.jadonamite.near"),
    keeper: None,
};
