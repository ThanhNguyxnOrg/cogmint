use crate::error::AppResult;
use crate::git::{git_command, git_command_raw};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MergePreview {
    pub base_branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub has_conflicts: bool,
    pub conflicting_files: Vec<String>,
}

/// Read-only merge dry-run using `git merge-tree --write-tree` (never mutates index or working tree).
pub fn preview_merge(dir: &Path, base_branch: &str) -> AppResult<MergePreview> {
    if base_branch.trim().is_empty() || base_branch.trim().starts_with('-') {
        return Err(crate::error::AppError::InvalidInput(
            "Invalid base branch name".into(),
        ));
    }
    let counts = git_command(
        dir,
        &[
            "rev-list",
            "--left-right",
            "--count",
            &format!("{base_branch}...HEAD"),
        ],
    )
    .unwrap_or_else(|_| "0\t0".into());

    let mut parts = counts.split_whitespace();
    let behind = parts
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    let ahead = parts
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);

    let out = git_command_raw(dir, &["merge-tree", "--write-tree", base_branch, "HEAD"])?;
    let has_conflicts = !out.status.success();
    let mut conflicting_files = Vec::new();
    if has_conflicts {
        let stdout = String::from_utf8_lossy(&out.stdout);
        for line in stdout.lines() {
            if let Some(rest) = line.strip_prefix("CONFLICT ") {
                if let Some(idx) = rest.rfind(" in ") {
                    let file = rest[idx + 4..].trim().to_string();
                    if !conflicting_files.contains(&file) {
                        conflicting_files.push(file);
                    }
                }
            }
        }
    }

    Ok(MergePreview {
        base_branch: base_branch.to_string(),
        ahead,
        behind,
        has_conflicts,
        conflicting_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::get_git_status;

    #[test]
    fn test_merge_preview_detects_conflict_without_mutating_working_tree() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        git_command(p, &["init", "-b", "main"]).unwrap();
        git_command(p, &["config", "user.email", "test@cogmint.dev"]).unwrap();
        git_command(p, &["config", "user.name", "COGMINT Test"]).unwrap();
        std::fs::write(p.join("file.txt"), "line 1\n").unwrap();
        git_command(p, &["add", "."]).unwrap();
        git_command(p, &["commit", "-m", "base"]).unwrap();

        git_command(p, &["checkout", "-b", "feat"]).unwrap();
        std::fs::write(p.join("file.txt"), "feat change\n").unwrap();
        git_command(p, &["commit", "-am", "feat"]).unwrap();

        git_command(p, &["checkout", "main"]).unwrap();
        std::fs::write(p.join("file.txt"), "main change\n").unwrap();
        git_command(p, &["commit", "-am", "main"]).unwrap();

        git_command(p, &["checkout", "feat"]).unwrap();

        let preview = preview_merge(p, "main").unwrap();
        assert!(preview.has_conflicts);
        assert_eq!(preview.ahead, 1);
        assert_eq!(preview.behind, 1);
        assert!(preview.conflicting_files.contains(&"file.txt".to_string()));

        // Working tree must remain completely clean
        let status = get_git_status(p).unwrap();
        assert!(status.changes.is_empty());
    }
}
