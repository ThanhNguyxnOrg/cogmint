pub mod commands;
pub mod db;
pub mod editor;
pub mod error;
pub mod git;
pub mod harness;
pub mod pty;
pub mod usage;
pub mod watcher;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve OS app data directory");
            let db_path = data_dir.join("cogmint.db");
            let database = db::Database::open(&db_path).expect("failed to initialize SQLite DB");
            app.manage(database);
            app.manage(pty::PtyManager::new());
            app.manage(watcher::WorkspaceWatcher::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pty_cmds::spawn_pane_pty,
            commands::pty_cmds::write_pty,
            commands::pty_cmds::resize_pty,
            commands::pty_cmds::kill_pty,
            commands::pty_cmds::detect_shells,
            commands::pty_cmds::list_wsl_distros,
            commands::harness_cmds::list_harnesses,
            commands::harness_cmds::upsert_custom_harness,
            commands::harness_cmds::delete_custom_harness,
            commands::harness_cmds::resolve_resume_session,
            commands::harness_cmds::list_harness_auth_profiles,
            commands::harness_cmds::save_harness_auth_profile,
            commands::harness_cmds::clear_harness_auth_profile,
            commands::git_cmds::get_git_status,
            commands::git_cmds::get_file_diff,
            commands::git_cmds::stage_files,
            commands::git_cmds::unstage_files,
            commands::git_cmds::commit_changes,
            commands::git_cmds::get_merge_preview,
            commands::workspace_cmds::register_project,
            commands::workspace_cmds::delete_project,
            commands::workspace_cmds::list_workspaces,
            commands::workspace_cmds::create_worktree,
            commands::workspace_cmds::remove_worktree,
            commands::workspace_cmds::watch_workspace,
            commands::workspace_cmds::unwatch_workspace,
            commands::workspace_cmds::save_workspace_layout,
            commands::workspace_cmds::load_workspace_journal,
            commands::workspace_cmds::mark_boot_clean,
            commands::editor_cmds::open_in_editor,
            commands::usage_cmds::get_usage_summary,
            commands::usage_cmds::list_pricing,
            commands::usage_cmds::refresh_pricing,
            commands::usage_cmds::set_pricing_override,
        ])
        .build(tauri::generate_context!())
        .expect("error while building COGMINT")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
                if let Some(pty) = app_handle.try_state::<pty::PtyManager>() {
                    pty.kill_all();
                }
            }
        });
}
