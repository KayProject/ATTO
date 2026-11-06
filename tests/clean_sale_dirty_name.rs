mod common;
#[tokio::test]
async fn dirty_name_sale_clears_seller_access() -> anyhow::Result<()> {
    common::sale::run_sale(false).await
}
