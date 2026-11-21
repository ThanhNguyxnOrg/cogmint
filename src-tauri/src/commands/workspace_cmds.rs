use crate::db::{BootStatus, Database, PaneJournalRecord, ProjectRecord, WorkspaceRecord};
use crate::error::{AppError, AppResult};
use crate::git::is_git_repo;
use crate::git::worktree::{
    create_worktree as git_create_worktree, list_worktrees, remove_worktree as git_remove_worktree,
    CreateWorktreeRequest, WorktreeInfo, WorktreeRecoveryReport,
};
use crate::watcher::WorkspaceWatcher;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceJournalSnapshot {
    pub boot_status: BootStatus,
    pub projects: Vec<ProjectRecord>,
    pub workspaces: Vec<WorkspaceRecord>,
    pub panes: Vec<PaneJournalRecord>,
    pub layouts: HashMap<String, String>,
    pub missing_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeResponse {
    pub ok: bool,
    pub workspace: Option<WorkspaceRecord>,
    pub worktree: Option<WorktreeInfo>,
    pub recovery: Option<WorktreeRecoveryReport>,
}

#[tauri::command]
pub fn register_project(
    db: State<'_, Database>,
    root_path: String,
) -> AppResult<(ProjectRecord, Vec<WorkspaceRecord>)> {
    let path = PathBuf::from(&root_path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "Directory does not exist: {root_path}"
        )));
    }
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_string();
    let git_repo = is_git_repo(&path);
    let project = ProjectRecord {
        id: Uuid::new_v4().to_string(),
        name: name.clone(),
        root_path: root_path.clone(),
        is_git_repo: git_repo,
        created_at: chrono::Utc::now().timestamp_millis(),
    };
    db.upsert_project(&project)?;

    let mut created_workspaces = Vec::new();
    if git_repo {
        let wts = list_worktrees(&path).unwrap_or_default();
        for wt in wts {
            let ws_name = wt.branch.clone().unwrap_or_else(|| name.clone());
            let ws = WorkspaceRecord {
                id: Uuid::new_v4().to_string(),
                project_id: project.id.clone(),
                name: ws_name,
                path: wt.path,
                branch: wt.branch,
                is_git_repo: true,
                is_worktree: !wt.is_main,
                shell_profile: None,
            };
            db.upsert_workspace(&ws)?;
            created_workspaces.push(ws);
        }
    } else {
        let ws = WorkspaceRecord {
            id: Uuid::new_v4().to_string(),
            project_id: project.id.clone(),
            name,
            path: root_path,
            branch: None,
            is_git_repo: false,
            is_worktree: false,
            shell_profile: None,
        };
        db.upsert_workspace(&ws)?;
        created_workspaces.push(ws);
    }

    Ok((project, created_workspaces))
}

#[tauri::command]
pub fn list_workspaces(db: State<'_, Database>) -> AppResult<Vec<WorkspaceRecord>> {
    db.list_workspaces()
}

#[tauri::command]
pub fn create_worktree(
    db: State<'_, Database>,
    project_id: String,
    request: CreateWorktreeRequest,
) -> AppResult<CreateWorktreeResponse> {
    match git_create_worktree(&request) {
        Ok(wt) => {
            let ws = WorkspaceRecord {
                id: Uuid::new_v4().to_string(),
                project_id,
                name: wt.branch.clone().unwrap_or_else(|| request.branch.clone()),
                path: wt.path.clone(),
                branch: wt.branch.clone(),
                is_git_repo: true,
                is_worktree: true,
                shell_profile: None,
            };
            db.upsert_workspace(&ws)?;
            Ok(CreateWorktreeResponse {
                ok: true,
                workspace: Some(ws),
                worktree: Some(wt),
                recovery: None,
            })
        }
        Err((_, report)) => Ok(CreateWorktreeResponse {
            ok: false,
            workspace: None,
            worktree: None,
            recovery: Some(report),
        }),
    }
}

#[tauri::command]
pub fn remove_worktree(
    db: State<'_, Database>,
    watcher: State<'_, WorkspaceWatcher>,
    workspace_id: String,
    repo_root: String,
    worktree_path: String,
    force: bool,
) -> AppResult<()> {
    // Drop FS watcher handle first so Windows never hits EBUSY / sharing violation
    watcher.unwatch(&workspace_id);
    git_remove_worktree(&PathBuf::from(repo_root), &PathBuf::from(worktree_path), force)?;
    db.delete_workspace(&workspace_id)?;
    Ok(())
}

#[tauri::command]
pub fn watch_workspace(
    app: AppHandle,
    watcher: State<'_, WorkspaceWatcher>,
    workspace_id: String,
    path: String,
) -> AppResult<()> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Ok(());
    }
    watcher.watch(&workspace_id, &target, move |dirty_ws_id| {
        let _ = app.emit("workspace:dirty", dirty_ws_id);
    })
}

#[tauri::command]
pub fn save_workspace_layout(
    db: State<'_, Database>,
    workspace_id: String,
    tree_json: String,
    panes: Vec<PaneJournalRecord>,
) -> AppResult<()> {
    db.save_layout_tree(&workspace_id, &tree_json)?;
    for pane in &panes {
        db.upsert_pane(pane)?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_workspace_journal(db: State<'_, Database>) -> AppResult<WorkspaceJournalSnapshot> {
    let now_ms = chrono::Utc::now().timestamp_millis();
    let boot_status = db.record_boot_start(now_ms)?;
    let projects = db.list_projects()?;
    let workspaces = db.list_workspaces()?;
    let panes = db.list_panes()?;
    let mut layouts = HashMap::new();
    let mut missing_paths = Vec::new();

    for ws in &workspaces {
        if !std::path::Path::new(&ws.path).exists() {
            missing_paths.push(ws.path.clone());
        }
        if let Some(tree) = db.load_layout_tree(&ws.id)? {
            layouts.insert(ws.id.clone(), tree);
        }
    }

    Ok(WorkspaceJournalSnapshot {
        boot_status,
        projects,
        workspaces,
        panes,
        layouts,
        missing_paths,
    })
}

#[tauri::command]
pub fn mark_boot_clean(db: State<'_, Database>) -> AppResult<()> {
    db.mark_boot_clean()
}
