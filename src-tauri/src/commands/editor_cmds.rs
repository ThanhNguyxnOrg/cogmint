use crate::editor::{open_in_editor as launch_editor, EditorPreset};
use crate::error::AppResult;
use std::path::PathBuf;

#[tauri::command]
pub fn open_in_editor(
    preset: EditorPreset,
    path: String,
    line: Option<u32>,
    col: Option<u32>,
) -> AppResult<()> {
    launch_editor(&preset, &PathBuf::from(path), line, col)
}
