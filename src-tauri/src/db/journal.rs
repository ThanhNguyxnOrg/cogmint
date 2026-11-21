use crate::db::Database;
use crate::error::AppResult;
use crate::harness::auth::HarnessAuthProfile;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const CRASH_WINDOW_MS: i64 = 10_000;
const CRASH_LOOP_THRESHOLD: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BootStatus {
    pub safe_mode: bool,
    pub recent_unclean_boots: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub is_git_repo: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: String,
    pub branch: Option<String>,
    pub is_git_repo: bool,
    pub is_worktree: bool,
    pub shell_profile: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PaneJournalRecord {
    pub id: String,
    pub workspace_id: String,
    pub harness_id: String,
    pub title: String,
    pub pinned: bool,
    pub resume_session_id: Option<String>,
    pub last_summary: Option<String>,
    pub custom_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CustomHarnessRecord {
    pub id: String,
    pub name: String,
    pub command: String,
    pub default_args: Vec<String>,
    pub accent_color: String,
    pub enabled: bool,
}

impl Database {
    pub fn record_boot_start(&self, now_ms: i64) -> AppResult<BootStatus> {
        let conn = self.lock_conn()?;
        let window_start = now_ms.saturating_sub(CRASH_WINDOW_MS);
        let recent_unclean: u32 = conn.query_row(
            "SELECT COUNT(*) FROM boot_history WHERE clean = 0 AND started_at >= ?1",
            params![window_start],
            |row| row.get(0),
        )?;

        conn.execute(
            "INSERT INTO boot_history (started_at, clean) VALUES (?1, 0)",
            params![now_ms],
        )?;

        Ok(BootStatus {
            safe_mode: recent_unclean >= CRASH_LOOP_THRESHOLD,
            recent_unclean_boots: recent_unclean,
        })
    }

    pub fn mark_boot_clean(&self) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute("UPDATE boot_history SET clean = 1 WHERE clean = 0", [])?;
        Ok(())
    }

    pub fn upsert_project(&self, project: &ProjectRecord) -> AppResult<ProjectRecord> {
        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT INTO projects (id, name, root_path, is_git_repo, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(root_path) DO UPDATE SET
               name = excluded.name,
               is_git_repo = excluded.is_git_repo",
            params![
                project.id,
                project.name,
                project.root_path,
                project.is_git_repo as i32,
                project.created_at,
            ],
        )?;
        let saved = conn.query_row(
            "SELECT id, name, root_path, is_git_repo, created_at FROM projects WHERE root_path = ?1",
            params![project.root_path],
            |row| {
                Ok(ProjectRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    root_path: row.get(2)?,
                    is_git_repo: row.get::<_, i32>(3)? != 0,
                    created_at: row.get(4)?,
                })
            },
        )?;
        Ok(saved)
    }

    pub fn list_projects(&self) -> AppResult<Vec<ProjectRecord>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, root_path, is_git_repo, created_at FROM projects ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ProjectRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                is_git_repo: row.get::<_, i32>(3)? != 0,
                created_at: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_project(&self, project_id: &str) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id])?;
        Ok(())
    }

    pub fn upsert_workspace(&self, ws: &WorkspaceRecord) -> AppResult<WorkspaceRecord> {
        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT INTO workspaces (id, project_id, name, path, branch, is_git_repo, is_worktree, shell_profile)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(path) DO UPDATE SET
               project_id = excluded.project_id,
               name = excluded.name,
               branch = excluded.branch,
               is_git_repo = excluded.is_git_repo,
               is_worktree = excluded.is_worktree,
               shell_profile = excluded.shell_profile",
            params![
                ws.id,
                ws.project_id,
                ws.name,
                ws.path,
                ws.branch,
                ws.is_git_repo as i32,
                ws.is_worktree as i32,
                ws.shell_profile,
            ],
        )?;
        let saved = conn.query_row(
            "SELECT id, project_id, name, path, branch, is_git_repo, is_worktree, shell_profile
             FROM workspaces WHERE path = ?1",
            params![ws.path],
            |row| {
                Ok(WorkspaceRecord {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    branch: row.get(4)?,
                    is_git_repo: row.get::<_, i32>(5)? != 0,
                    is_worktree: row.get::<_, i32>(6)? != 0,
                    shell_profile: row.get(7)?,
                })
            },
        )?;
        Ok(saved)
    }

    pub fn list_workspaces(&self) -> AppResult<Vec<WorkspaceRecord>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, path, branch, is_git_repo, is_worktree, shell_profile
             FROM workspaces ORDER BY is_worktree ASC, name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(WorkspaceRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                branch: row.get(4)?,
                is_git_repo: row.get::<_, i32>(5)? != 0,
                is_worktree: row.get::<_, i32>(6)? != 0,
                shell_profile: row.get(7)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_workspace(&self, workspace_id: &str) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![workspace_id])?;
        Ok(())
    }

    pub fn save_layout_tree(&self, workspace_id: &str, tree_json: &str) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT INTO layout_trees (workspace_id, tree_json) VALUES (?1, ?2)
             ON CONFLICT(workspace_id) DO UPDATE SET tree_json = excluded.tree_json",
            params![workspace_id, tree_json],
        )?;
        Ok(())
    }

    pub fn load_layout_tree(&self, workspace_id: &str) -> AppResult<Option<String>> {
        let conn = self.lock_conn()?;
        let tree = conn
            .query_row(
                "SELECT tree_json FROM layout_trees WHERE workspace_id = ?1",
                params![workspace_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(tree)
    }

    pub fn upsert_pane(&self, pane: &PaneJournalRecord) -> AppResult<()> {
        let conn = self.lock_conn()?;
        let args_json = serde_json::to_string(&pane.custom_args).unwrap_or_else(|_| "[]".into());
        conn.execute(
            "INSERT INTO panes (id, workspace_id, harness_id, title, pinned, resume_session_id, last_summary, custom_args_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
               workspace_id = excluded.workspace_id,
               harness_id = excluded.harness_id,
               title = excluded.title,
               pinned = excluded.pinned,
               resume_session_id = excluded.resume_session_id,
               last_summary = excluded.last_summary,
               custom_args_json = excluded.custom_args_json",
            params![
                pane.id,
                pane.workspace_id,
                pane.harness_id,
                pane.title,
                pane.pinned as i32,
                pane.resume_session_id,
                pane.last_summary,
                args_json,
            ],
        )?;
        Ok(())
    }

    pub fn list_panes(&self) -> AppResult<Vec<PaneJournalRecord>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, harness_id, title, pinned, resume_session_id, last_summary, custom_args_json
             FROM panes",
        )?;
        let rows = stmt.query_map([], |row| {
            let args_json: String = row.get(7)?;
            let custom_args: Vec<String> = serde_json::from_str(&args_json).unwrap_or_default();
            Ok(PaneJournalRecord {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                harness_id: row.get(2)?,
                title: row.get(3)?,
                pinned: row.get::<_, i32>(4)? != 0,
                resume_session_id: row.get(5)?,
                last_summary: row.get(6)?,
                custom_args,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_pane(&self, pane_id: &str) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM panes WHERE id = ?1", params![pane_id])?;
        Ok(())
    }

    pub fn sync_workspace_panes(
        &self,
        workspace_id: &str,
        tree_json: Option<&str>,
        panes: &[PaneJournalRecord],
    ) -> AppResult<()> {
        let mut conn = self.lock_conn()?;
        let tx = conn.transaction()?;
        match tree_json {
            Some(tree) => {
                tx.execute(
                    "INSERT INTO layout_trees (workspace_id, tree_json) VALUES (?1, ?2)
                     ON CONFLICT(workspace_id) DO UPDATE SET tree_json = excluded.tree_json",
                    params![workspace_id, tree],
                )?;
            }
            None => {
                tx.execute(
                    "DELETE FROM layout_trees WHERE workspace_id = ?1",
                    params![workspace_id],
                )?;
            }
        }
        tx.execute(
            "DELETE FROM panes WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        for pane in panes {
            let args_json = serde_json::to_string(&pane.custom_args).unwrap_or_else(|_| "[]".into());
            tx.execute(
                "INSERT INTO panes (id, workspace_id, harness_id, title, pinned, resume_session_id, last_summary, custom_args_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    pane.id,
                    workspace_id,
                    pane.harness_id,
                    pane.title,
                    pane.pinned as i32,
                    pane.resume_session_id,
                    pane.last_summary,
                    args_json,
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn upsert_custom_harness(&self, rec: &CustomHarnessRecord) -> AppResult<()> {
        let conn = self.lock_conn()?;
        let args_json = serde_json::to_string(&rec.default_args).unwrap_or_else(|_| "[]".into());
        conn.execute(
            "INSERT INTO custom_harnesses (id, name, command, default_args_json, accent_color, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               command = excluded.command,
               default_args_json = excluded.default_args_json,
               accent_color = excluded.accent_color,
               enabled = excluded.enabled",
            params![
                rec.id,
                rec.name,
                rec.command,
                args_json,
                rec.accent_color,
                rec.enabled as i32,
            ],
        )?;
        Ok(())
    }

    pub fn list_custom_harnesses(&self) -> AppResult<Vec<CustomHarnessRecord>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, command, default_args_json, accent_color, enabled FROM custom_harnesses",
        )?;
        let rows = stmt.query_map([], |row| {
            let args_json: String = row.get(3)?;
            Ok(CustomHarnessRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                command: row.get(2)?,
                default_args: serde_json::from_str(&args_json).unwrap_or_default(),
                accent_color: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_custom_harness(&self, id: &str) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM custom_harnesses WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn upsert_harness_auth_profile(&self, profile: &HarnessAuthProfile) -> AppResult<()> {
        let conn = self.lock_conn()?;
        let extra_json =
            serde_json::to_string(&profile.extra_env).unwrap_or_else(|_| "{}".into());
        conn.execute(
            "INSERT INTO harness_auth_profiles (harness_id, api_key, base_url, extra_env_json, use_custom_env)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(harness_id) DO UPDATE SET
               api_key = excluded.api_key,
               base_url = excluded.base_url,
               extra_env_json = excluded.extra_env_json,
               use_custom_env = excluded.use_custom_env",
            params![
                profile.harness_id,
                profile.api_key,
                profile.base_url,
                extra_json,
                profile.use_custom_env as i32,
            ],
        )?;
        Ok(())
    }

    pub fn get_harness_auth_profile(
        &self,
        harness_id: &str,
    ) -> AppResult<Option<HarnessAuthProfile>> {
        let conn = self.lock_conn()?;
        let row = conn
            .query_row(
                "SELECT harness_id, api_key, base_url, extra_env_json, use_custom_env
                 FROM harness_auth_profiles WHERE harness_id = ?1",
                params![harness_id],
                |row| {
                    let extra_json: String = row.get(3)?;
                    let extra_env: HashMap<String, String> =
                        serde_json::from_str(&extra_json).unwrap_or_default();
                    Ok(HarnessAuthProfile {
                        harness_id: row.get(0)?,
                        api_key: row.get(1)?,
                        base_url: row.get(2)?,
                        extra_env,
                        use_custom_env: row.get::<_, i32>(4)? != 0,
                    })
                },
            )
            .optional()?;
        Ok(row)
    }

    pub fn list_harness_auth_profiles(&self) -> AppResult<Vec<HarnessAuthProfile>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT harness_id, api_key, base_url, extra_env_json, use_custom_env
             FROM harness_auth_profiles",
        )?;
        let rows = stmt.query_map([], |row| {
            let extra_json: String = row.get(3)?;
            let extra_env: HashMap<String, String> =
                serde_json::from_str(&extra_json).unwrap_or_default();
            Ok(HarnessAuthProfile {
                harness_id: row.get(0)?,
                api_key: row.get(1)?,
                base_url: row.get(2)?,
                extra_env,
                use_custom_env: row.get::<_, i32>(4)? != 0,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_harness_auth_profile(&self, harness_id: &str) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            "DELETE FROM harness_auth_profiles WHERE harness_id = ?1",
            params![harness_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crash_loop_guard_enters_safe_mode() {
        let db = Database::open_in_memory().unwrap();
        let b1 = db.record_boot_start(1_000).unwrap();
        assert!(!b1.safe_mode);
        let b2 = db.record_boot_start(4_000).unwrap();
        assert!(!b2.safe_mode);
        let b3 = db.record_boot_start(8_000).unwrap();
        assert!(b3.safe_mode);
        assert_eq!(b3.recent_unclean_boots, 2);
    }

    #[test]
    fn test_clean_boot_resets_crash_loop_counter() {
        let db = Database::open_in_memory().unwrap();
        db.record_boot_start(1_000).unwrap();
        db.mark_boot_clean().unwrap();
        let b2 = db.record_boot_start(3_000).unwrap();
        assert!(!b2.safe_mode);
        assert_eq!(b2.recent_unclean_boots, 0);
    }

    #[test]
    fn test_workspace_layout_and_pane_roundtrip() {
        let db = Database::open_in_memory().unwrap();
        let proj = ProjectRecord {
            id: "proj-1".into(),
            name: "cogmint".into(),
            root_path: "/repos/cogmint".into(),
            is_git_repo: true,
            created_at: 100,
        };
        db.upsert_project(&proj).unwrap();

        let ws = WorkspaceRecord {
            id: "ws-1".into(),
            project_id: "proj-1".into(),
            name: "feat/pty".into(),
            path: "/repos/cogmint-wt-pty".into(),
            branch: Some("feat/pty".into()),
            is_git_repo: true,
            is_worktree: true,
            shell_profile: Some("pwsh".into()),
        };
        db.upsert_workspace(&ws).unwrap();

        let pane = PaneJournalRecord {
            id: "pane-1".into(),
            workspace_id: "ws-1".into(),
            harness_id: "claude".into(),
            title: "Claude Code".into(),
            pinned: true,
            resume_session_id: Some("sess-abc".into()),
            last_summary: Some("Refactored PTY".into()),
            custom_args: vec!["--verbose".into()],
        };
        db.upsert_pane(&pane).unwrap();
        db.save_layout_tree("ws-1", r#"{"type":"leaf","id":"l1","paneIds":["pane-1"]}"#)
            .unwrap();

        assert_eq!(db.list_projects().unwrap(), vec![proj]);
        assert_eq!(db.list_workspaces().unwrap(), vec![ws]);
        assert_eq!(db.list_panes().unwrap(), vec![pane]);
        assert_eq!(
            db.load_layout_tree("ws-1").unwrap().as_deref(),
            Some(r#"{"type":"leaf","id":"l1","paneIds":["pane-1"]}"#)
        );
    }

    #[test]
    fn test_re_registering_same_project_path_returns_existing_id() {
        let db = Database::open_in_memory().unwrap();
        let first = db
            .upsert_project(&ProjectRecord {
                id: "id-1".into(),
                name: "cogmint".into(),
                root_path: "/repos/cogmint".into(),
                is_git_repo: true,
                created_at: 100,
            })
            .unwrap();
        let second = db
            .upsert_project(&ProjectRecord {
                id: "id-2-new-uuid".into(),
                name: "cogmint".into(),
                root_path: "/repos/cogmint".into(),
                is_git_repo: true,
                created_at: 200,
            })
            .unwrap();
        assert_eq!(first.id, second.id);
        assert_eq!(db.list_projects().unwrap().len(), 1);
    }
}
