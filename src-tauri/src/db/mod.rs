pub mod journal;
pub mod usage_cache;

use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub use journal::{BootStatus, CustomHarnessRecord, PaneJournalRecord, ProjectRecord, WorkspaceRecord};
pub use usage_cache::{PricingOverrideRecord, StoredUsageRecord};

pub struct Database {
    pub(crate) conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_pragmas_and_migrations()?;
        Ok(db)
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_pragmas_and_migrations()?;
        Ok(db)
    }

    pub(crate) fn lock_conn(&self) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|e| AppError::External(format!("DB mutex poisoned: {e}")))
    }

    fn init_pragmas_and_migrations(&self) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;

            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS boot_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at INTEGER NOT NULL,
                clean INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                root_path TEXT NOT NULL UNIQUE,
                is_git_repo INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                branch TEXT,
                is_git_repo INTEGER NOT NULL DEFAULT 0,
                is_worktree INTEGER NOT NULL DEFAULT 0,
                shell_profile TEXT
            );

            CREATE TABLE IF NOT EXISTS panes (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                harness_id TEXT NOT NULL,
                title TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                resume_session_id TEXT,
                last_summary TEXT,
                custom_args_json TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS layout_trees (
                workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
                tree_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS custom_harnesses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                command TEXT NOT NULL,
                default_args_json TEXT NOT NULL DEFAULT '[]',
                accent_color TEXT NOT NULL DEFAULT '#64748B',
                enabled INTEGER NOT NULL DEFAULT 1,
                icon_id TEXT
            );

            CREATE TABLE IF NOT EXISTS usage_files (
                path TEXT PRIMARY KEY,
                harness_id TEXT NOT NULL,
                byte_offset INTEGER NOT NULL DEFAULT 0,
                mtime_ms INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS usage_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                harness_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                project_path TEXT,
                model_id TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                cache_write_tokens INTEGER NOT NULL DEFAULT 0,
                UNIQUE(harness_id, session_id, message_id)
            );

            CREATE INDEX IF NOT EXISTS idx_usage_records_ts ON usage_records(timestamp_ms);
            CREATE INDEX IF NOT EXISTS idx_usage_records_harness ON usage_records(harness_id);

            CREATE TABLE IF NOT EXISTS pricing_overrides (
                model_id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                input_per_mtok REAL NOT NULL,
                output_per_mtok REAL NOT NULL,
                cache_read_per_mtok REAL NOT NULL,
                cache_write_per_mtok REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS harness_auth_profiles (
                harness_id TEXT PRIMARY KEY,
                api_key TEXT,
                base_url TEXT,
                extra_env_json TEXT NOT NULL DEFAULT '{}',
                use_custom_env INTEGER NOT NULL DEFAULT 0
            );
            ",
        )?;
        // Non-destructive migration for existing DBs created before icon_id column existed
        let _ = conn.execute("ALTER TABLE custom_harnesses ADD COLUMN icon_id TEXT", []);
        Ok(())
    }
}
