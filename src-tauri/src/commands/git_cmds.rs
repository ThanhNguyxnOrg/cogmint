use crate::error::AppResult;
use crate::git::merge_preview::{preview_merge, MergePreview};
use crate::git::{
    commit_changes as git_commit, get_file_diff as git_diff, get_git_status as git_status,
    stage_files as git_stage, unstage_files as git_unstage, FileDiffResult, GitStatusSummary,
};
use std::path::PathBuf;

#[tauri::command]
pub fn get_git_status(dir: String) -> AppResult<GitStatusSummary> {
    git_status(&PathBuf::from(dir))
}

#[tauri::command]
pub fn get_file_diff(dir: String, rel_path: String, staged: bool) -> AppResult<FileDiffResult> {
    git_diff(&PathBuf::from(dir), &rel_path, staged)
}

#[tauri::command]
pub fn stage_files(dir: String, paths: Vec<String>) -> AppResult<()> {
    git_stage(&PathBuf::from(dir), &paths)
}

#[tauri::command]
pub fn unstage_files(dir: String, paths: Vec<String>) -> AppResult<()> {
    git_unstage(&PathBuf::from(dir), &paths)
}

#[tauri::command]
pub fn commit_changes(dir: String, message: String) -> AppResult<String> {
    git_commit(&PathBuf::from(dir), &message)
}

#[tauri::command]
pub fn get_merge_preview(dir: String, base_branch: String) -> AppResult<MergePreview> {
    preview_merge(&PathBuf::from(dir), &base_branch)
}
