use crate::db::{Database, PricingOverrideRecord};
use crate::error::AppResult;
use crate::usage::pricing::{refresh_pricing_file, ModelPrice, PricingCatalog};
use crate::usage::{aggregate_usage, scan_local_logs_into_db, UsageSummary};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

fn pricing_cache_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("pricing-cache.json")
}

#[tauri::command]
pub fn get_usage_summary(
    app: AppHandle,
    db: State<'_, Database>,
    days: Option<u32>,
) -> AppResult<UsageSummary> {
    if let Some(home) = dirs::home_dir() {
        let _ = scan_local_logs_into_db(&db, &home);
    }
    let overrides = db.list_pricing_overrides()?;
    let catalog = PricingCatalog::load_with_cache(&pricing_cache_path(&app), overrides);
    aggregate_usage(&db, &catalog, days.unwrap_or(30))
}

#[tauri::command]
pub fn list_pricing(app: AppHandle, db: State<'_, Database>) -> AppResult<Vec<ModelPrice>> {
    let overrides = db.list_pricing_overrides()?;
    let catalog = PricingCatalog::load_with_cache(&pricing_cache_path(&app), overrides);
    Ok(catalog.all_prices())
}

#[tauri::command]
pub async fn refresh_pricing(app: AppHandle, url: String) -> AppResult<String> {
    let parsed = refresh_pricing_file(&url, &pricing_cache_path(&app)).await?;
    Ok(parsed.updated_at)
}

#[tauri::command]
pub fn set_pricing_override(
    db: State<'_, Database>,
    record: PricingOverrideRecord,
) -> AppResult<()> {
    db.upsert_pricing_override(&record)
}
