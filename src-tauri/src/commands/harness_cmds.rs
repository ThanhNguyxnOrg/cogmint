use crate::db::{CustomHarnessRecord, Database};
use crate::error::AppResult;
use crate::harness::auth::{
    HarnessAuthProfile, HarnessAuthProfileSummary, SaveHarnessAuthProfileRequest,
};
use crate::harness::resume::resolve_latest_session_id;
use crate::harness::{list_all_harnesses, upsert_custom_harness_record, HarnessSpec};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn list_harnesses(db: State<'_, Database>) -> AppResult<Vec<HarnessSpec>> {
    list_all_harnesses(&db)
}

#[tauri::command]
pub fn upsert_custom_harness(
    db: State<'_, Database>,
    record: CustomHarnessRecord,
) -> AppResult<()> {
    upsert_custom_harness_record(&db, &record)
}

#[tauri::command]
pub fn delete_custom_harness(db: State<'_, Database>, id: String) -> AppResult<()> {
    db.delete_custom_harness(&id)
}

#[tauri::command]
pub async fn resolve_resume_session(harness_id: String, cwd: String) -> Option<String> {
    let home = dirs::home_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        resolve_latest_session_id(&harness_id, &PathBuf::from(cwd), &home)
    })
    .await
    .ok()?
}

#[tauri::command]
pub fn list_harness_auth_profiles(
    db: State<'_, Database>,
) -> AppResult<Vec<HarnessAuthProfileSummary>> {
    Ok(db
        .list_harness_auth_profiles()?
        .into_iter()
        .map(|p| p.to_summary())
        .collect())
}

#[tauri::command]
pub fn save_harness_auth_profile(
    db: State<'_, Database>,
    request: SaveHarnessAuthProfileRequest,
) -> AppResult<HarnessAuthProfileSummary> {
    let existing = db.get_harness_auth_profile(&request.harness_id)?;
    let api_key = if request.clear_api_key {
        None
    } else if let Some(new_key) = request.api_key.filter(|s| !s.trim().is_empty()) {
        Some(new_key.trim().to_string())
    } else {
        existing.and_then(|e| e.api_key)
    };

    let profile = HarnessAuthProfile {
        harness_id: request.harness_id,
        api_key,
        base_url: request
            .base_url
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        extra_env: request.extra_env,
        use_custom_env: request.use_custom_env,
    };
    db.upsert_harness_auth_profile(&profile)?;
    Ok(profile.to_summary())
}

#[tauri::command]
pub fn clear_harness_auth_profile(db: State<'_, Database>, harness_id: String) -> AppResult<()> {
    db.delete_harness_auth_profile(&harness_id)
}
