pub mod commands;
pub mod db;
pub mod error;
pub mod pty;

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pty_cmds::spawn_pane_pty,
            commands::pty_cmds::write_pty,
            commands::pty_cmds::resize_pty,
            commands::pty_cmds::kill_pty,
            commands::pty_cmds::detect_shells,
            commands::pty_cmds::list_wsl_distros,
        ])
        .run(tauri::generate_context!())
        .expect("error while running COGMINT");
}
