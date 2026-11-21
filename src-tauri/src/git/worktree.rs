use crate::error::{AppError, AppResult};
use crate::git::git_command;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: Option<String>,
    pub head_sha: Option<String>,
    pub is_main: bool,
    pub is_prunable: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeRequest {
    pub repo_root: String,
    pub branch: String,
    pub base_ref: Option<String>,
    pub target_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeRecoveryReport {
    pub branch_exists: bool,
    pub dir_exists: bool,
    pub registered: bool,
    pub message: String,
}

pub fn list_worktrees(repo_root: &Path) -> AppResult<Vec<WorktreeInfo>> {
    let out = git_command(repo_root, &["worktree", "list", "--porcelain"])?;
    let mut results = Vec::new();
    let mut cur_path: Option<String> = None;
    let mut cur_head: Option<String> = None;
    let mut cur_branch: Option<String> = None;
    let mut cur_prunable = false;

    let flush = |results: &mut Vec<WorktreeInfo>,
                 cur_path: &mut Option<String>,
                 cur_head: &mut Option<String>,
                 cur_branch: &mut Option<String>,
                 cur_prunable: &mut bool| {
        if let Some(path) = cur_path.take() {
            let is_main = results.is_empty();
            results.push(WorktreeInfo {
                path,
                branch: cur_branch.take(),
                head_sha: cur_head.take(),
                is_main,
                is_prunable: *cur_prunable,
            });
            *cur_prunable = false;
        }
    };

    for line in out.lines() {
        if line.trim().is_empty() {
            flush(
                &mut results,
                &mut cur_path,
                &mut cur_head,
                &mut cur_branch,
                &mut cur_prunable,
            );
            continue;
        }
        if let Some(p) = line.strip_prefix("worktree ") {
            cur_path = Some(p.trim().to_string());
        } else if let Some(h) = line.strip_prefix("HEAD ") {
            cur_head = Some(h.trim().to_string());
        } else if let Some(b) = line.strip_prefix("branch ") {
            let trimmed = b.trim();
            let short = trimmed.strip_prefix("refs/heads/").unwrap_or(trimmed);
            cur_branch = Some(short.to_string());
        } else if line.starts_with("prunable") {
            cur_prunable = true;
        }
    }
    flush(
        &mut results,
        &mut cur_path,
        &mut cur_head,
        &mut cur_branch,
        &mut cur_prunable,
    );

    Ok(results)
}

fn branch_exists(repo_root: &Path, branch: &str) -> bool {
    git_command(
        repo_root,
        &["show-ref", "--verify", "--quiet", &format!("refs/heads/{branch}")],
    )
    .is_ok()
}

fn default_worktree_dir(repo_root: &Path, branch: &str) -> PathBuf {
    let safe_branch: String = branch
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let repo_name = repo_root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("repo");
    let parent = repo_root.parent().unwrap_or(repo_root);
    parent.join(format!("{repo_name}-wt-{safe_branch}"))
}

pub fn create_worktree(
    req: &CreateWorktreeRequest,
) -> Result<WorktreeInfo, (AppError, WorktreeRecoveryReport)> {
    let repo_root = Path::new(&req.repo_root);
    let branch = req.branch.trim();
    if branch.is_empty()
        || branch.starts_with('-')
        || branch.contains("..")
        || branch.contains(' ')
    {
        let report = WorktreeRecoveryReport {
            branch_exists: false,
            dir_exists: false,
            registered: false,
            message: "Branch name is invalid".into(),
        };
        return Err((AppError::InvalidInput("Invalid branch name".into()), report));
    }
    if let Some(base) = req.base_ref.as_deref() {
        if base.trim().starts_with('-') {
            let report = WorktreeRecoveryReport {
                branch_exists: false,
                dir_exists: false,
                registered: false,
                message: "Base ref cannot start with '-'".into(),
            };
            return Err((AppError::InvalidInput("Invalid base ref".into()), report));
        }
    }

    let target = req
        .target_dir
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| default_worktree_dir(repo_root, branch));

    // Never overwrite or auto-delete an existing directory
    if target.exists() {
        let registered = list_worktrees(repo_root)
            .unwrap_or_default()
            .iter()
            .any(|w| Path::new(&w.path) == target);
        let report = WorktreeRecoveryReport {
            branch_exists: branch_exists(repo_root, branch),
            dir_exists: true,
            registered,
            message: format!(
                "Target directory '{}' already exists. Inspect or choose another path; COGMINT will not auto-delete it.",
                target.display()
            ),
        };
        return Err((AppError::Git(report.message.clone()), report));
    }

    let target_str = target.to_string_lossy().to_string();
    let has_branch = branch_exists(repo_root, branch);
    let mut args = vec!["worktree", "add"];
    if has_branch {
        args.push(&target_str);
        args.push(branch);
    } else {
        args.push("-b");
        args.push(branch);
        args.push(&target_str);
        if let Some(base) = req.base_ref.as_deref().filter(|s| !s.trim().is_empty()) {
            args.push(base);
        }
    }

    if let Err(err) = git_command(repo_root, &args) {
        let registered = list_worktrees(repo_root)
            .unwrap_or_default()
            .iter()
            .any(|w| Path::new(&w.path) == target);
        let report = WorktreeRecoveryReport {
            branch_exists: branch_exists(repo_root, branch),
            dir_exists: target.exists(),
            registered,
            message: format!(
                "Worktree creation failed ({err}). Inspect state before retrying; no files were deleted."
            ),
        };
        return Err((err, report));
    }

    let _ = copy_worktree_includes(repo_root, &target);

    let head_sha = git_command(&target, &["rev-parse", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string());

    Ok(WorktreeInfo {
        path: target_str,
        branch: Some(branch.to_string()),
        head_sha,
        is_main: false,
        is_prunable: false,
    })
}

pub fn remove_worktree(repo_root: &Path, worktree_path: &Path, force: bool) -> AppResult<()> {
    let wt_str = worktree_path.to_string_lossy().to_string();
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(&wt_str);
    git_command(repo_root, &args)?;
    Ok(())
}

/// Copies files listed in `<repo_root>/.worktreeinclude` into the new worktree.
/// Strictly rejects absolute paths or `..` path traversal components.
pub fn copy_worktree_includes(repo_root: &Path, worktree_path: &Path) -> AppResult<Vec<String>> {
    let include_file = repo_root.join(".worktreeinclude");
    if !include_file.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&include_file)?;
    let canon_root = std::fs::canonicalize(repo_root)?;
    let mut copied = Vec::new();

    for raw_line in content.lines() {
        let entry = raw_line.trim();
        if entry.is_empty() || entry.starts_with('#') {
            continue;
        }
        let rel = Path::new(entry);
        if rel.is_absolute()
            || rel
                .components()
                .any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
        {
            return Err(AppError::InvalidInput(format!(
                "Path traversal or absolute path not allowed in .worktreeinclude: '{entry}'"
            )));
        }

        let src = repo_root.join(rel);
        if !src.exists() {
            continue;
        }
        let canon_src = std::fs::canonicalize(&src)?;
        if !canon_src.starts_with(&canon_root) {
            return Err(AppError::InvalidInput(format!(
                "Symlink escapes repository root in .worktreeinclude: '{entry}'"
            )));
        }

        let dst = worktree_path.join(rel);
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if src.is_file() {
            std::fs::copy(&src, &dst)?;
            copied.push(entry.to_string());
        }
    }

    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::is_git_repo;

    fn init_temp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        git_command(p, &["init", "-b", "main"]).unwrap();
        git_command(p, &["config", "user.email", "test@cogmint.dev"]).unwrap();
        git_command(p, &["config", "user.name", "COGMINT Test"]).unwrap();
        std::fs::write(p.join("README.md"), "# Test\n").unwrap();
        git_command(p, &["add", "."]).unwrap();
        git_command(p, &["commit", "-m", "init"]).unwrap();
        tmp
    }

    #[test]
    fn test_create_list_and_remove_worktree_in_temp_git_repo() {
        let repo = init_temp_repo();
        let wt_parent = tempfile::tempdir().unwrap();
        let wt_dir = wt_parent.path().join("wt-feat-test");

        let info = create_worktree(&CreateWorktreeRequest {
            repo_root: repo.path().to_string_lossy().to_string(),
            branch: "feat/test".into(),
            base_ref: None,
            target_dir: Some(wt_dir.to_string_lossy().to_string()),
        })
        .unwrap();
        assert_eq!(info.branch.as_deref(), Some("feat/test"));
        assert_eq!(list_worktrees(repo.path()).unwrap().len(), 2);

        remove_worktree(repo.path(), &wt_dir, false).unwrap();
        assert_eq!(list_worktrees(repo.path()).unwrap().len(), 1);
    }

    #[test]
    fn test_worktreeinclude_copies_valid_files_and_rejects_path_traversal() {
        let repo = init_temp_repo();
        let wt_dir = tempfile::tempdir().unwrap();
        std::fs::write(repo.path().join(".env.local"), "SECRET=1\n").unwrap();
        std::fs::write(repo.path().join(".worktreeinclude"), ".env.local\n").unwrap();

        let copied = copy_worktree_includes(repo.path(), wt_dir.path()).unwrap();
        assert_eq!(copied, vec![".env.local"]);
        assert_eq!(
            std::fs::read_to_string(wt_dir.path().join(".env.local")).unwrap(),
            "SECRET=1\n"
        );

        std::fs::write(repo.path().join(".worktreeinclude"), "../outside.txt\n").unwrap();
        let err = copy_worktree_includes(repo.path(), wt_dir.path()).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn test_create_worktree_existing_dir_returns_recovery_report_without_deleting_dir() {
        let repo = init_temp_repo();
        let existing = tempfile::tempdir().unwrap();
        let sentinel = existing.path().join("keep-me.txt");
        std::fs::write(&sentinel, "important").unwrap();

        let (_, report) = create_worktree(&CreateWorktreeRequest {
            repo_root: repo.path().to_string_lossy().to_string(),
            branch: "feat/existing".into(),
            base_ref: None,
            target_dir: Some(existing.path().to_string_lossy().to_string()),
        })
        .unwrap_err();

        assert!(report.dir_exists);
        assert!(sentinel.exists(), "existing directory must never be deleted");
    }

    #[test]
    fn test_non_git_directory_probe_returns_false_cleanly() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(!is_git_repo(tmp.path()));
    }
}
