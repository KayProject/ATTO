use near_sdk::{near, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Escrow {}
