use crate::db::{CustomHarnessRecord, Database};
use crate::error::AppResult;
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
pub fn resolve_resume_session(harness_id: String, cwd: String) -> Option<String> {
    let home = dirs::home_dir()?;
    resolve_latest_session_id(&harness_id, &PathBuf::from(cwd), &home)
}
