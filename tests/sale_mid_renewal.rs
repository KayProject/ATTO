mod common;
#[tokio::test]
async fn sale_mid_renewal() -> anyhow::Result<()> {
    common::sale::run_sale(true).await
}
