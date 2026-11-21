pub mod db;
pub mod error;

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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running COGMINT");
}
