use crate::error::AppResult;
use crate::pty::shell::{detect_available_shells, list_wsl_distros as get_wsl_distros, ShellProfile};
use crate::pty::{PtyManager, PtyStreamEvent, SpawnPtyRequest};
use tauri::ipc::Channel;
use tauri::State;

#[tauri::command]
pub fn spawn_pane_pty(
    pty: State<'_, PtyManager>,
    request: SpawnPtyRequest,
    on_event: Channel<PtyStreamEvent>,
) -> AppResult<()> {
    pty.spawn(request, move |event| {
        let _ = on_event.send(event);
    })
}

#[tauri::command]
pub fn write_pty(pty: State<'_, PtyManager>, pane_id: String, data: String) -> AppResult<()> {
    pty.write(&pane_id, data.as_bytes())
}

#[tauri::command]
pub fn resize_pty(
    pty: State<'_, PtyManager>,
    pane_id: String,
    cols: u16,
    rows: u16,
) -> AppResult<()> {
    pty.resize(&pane_id, cols, rows)
}

#[tauri::command]
pub fn kill_pty(pty: State<'_, PtyManager>, pane_id: String) -> AppResult<()> {
    pty.kill(&pane_id)
}

#[tauri::command]
pub fn detect_shells() -> Vec<ShellProfile> {
    detect_available_shells()
}

#[tauri::command]
pub fn list_wsl_distros() -> Vec<String> {
    get_wsl_distros()
}
