pub mod merge_preview;
pub mod worktree;

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::{Command, Output};

const MAX_DIFF_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEntry {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub untracked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusSummary {
    pub is_git_repo: bool,
    pub branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub changes: Vec<FileChangeEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffResult {
    pub path: String,
    pub is_binary: bool,
    pub truncated: bool,
    pub unified_diff: String,
}

pub(crate) fn git_command_raw(dir: &Path, args: &[&str]) -> AppResult<Output> {
    let mut cmd = Command::new("git");
    cmd.current_dir(dir).args(args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output()
        .map_err(|e| AppError::Git(format!("Failed to execute git: {e}")))
}

pub(crate) fn git_command(dir: &Path, args: &[&str]) -> AppResult<String> {
    let out = git_command_raw(dir, args)?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(AppError::Git(if stderr.is_empty() {
            format!("git {} failed with status {}", args.join(" "), out.status)
        } else {
            stderr
        }));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

pub fn is_git_repo(dir: &Path) -> bool {
    if !dir.exists() {
        return false;
    }
    git_command_raw(dir, &["rev-parse", "--is-inside-work-tree"])
        .map(|o| o.status.success() && String::from_utf8_lossy(&o.stdout).trim() == "true")
        .unwrap_or(false)
}

pub fn get_git_status(dir: &Path) -> AppResult<GitStatusSummary> {
    if !is_git_repo(dir) {
        return Ok(GitStatusSummary {
            is_git_repo: false,
            branch: None,
            ahead: 0,
            behind: 0,
            changes: Vec::new(),
        });
    }

    let out = git_command(dir, &["status", "--porcelain=v2", "--branch"])?;
    let mut branch = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut changes = Vec::new();

    for line in out.lines() {
        if let Some(b) = line.strip_prefix("# branch.head ") {
            let b = b.trim();
            if b != "(detached)" {
                branch = Some(b.to_string());
            }
        } else if let Some(ab) = line.strip_prefix("# branch.ab ") {
            for part in ab.split_whitespace() {
                if let Some(a) = part.strip_prefix('+') {
                    ahead = a.parse().unwrap_or(0);
                } else if let Some(b) = part.strip_prefix('-') {
                    behind = b.parse().unwrap_or(0);
                }
            }
        } else if let Some(rest) = line.strip_prefix("1 ").or_else(|| line.strip_prefix("2 ")) {
            let tokens: Vec<&str> = rest.splitn(8, ' ').collect();
            if tokens.len() >= 8 {
                let xy = tokens[0];
                let x = xy.chars().next().unwrap_or('.');
                let y = xy.chars().nth(1).unwrap_or('.');
                let path = tokens[7].split('\t').next().unwrap_or(tokens[7]).to_string();
                let staged = x != '.';
                let status = if y != '.' { y } else { x }.to_string();
                changes.push(FileChangeEntry {
                    path,
                    status,
                    staged,
                    untracked: false,
                });
            }
        } else if let Some(path) = line.strip_prefix("? ") {
            changes.push(FileChangeEntry {
                path: path.trim().to_string(),
                status: "?".into(),
                staged: false,
                untracked: true,
            });
        }
    }

    Ok(GitStatusSummary {
        is_git_repo: true,
        branch,
        ahead,
        behind,
        changes,
    })
}

pub fn get_file_diff(dir: &Path, rel_path: &str, staged: bool) -> AppResult<FileDiffResult> {
    let mut args = vec!["diff", "--no-color"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(rel_path);

    let out = git_command_raw(dir, &args)?;
    let mut bytes = out.stdout;

    // If diff is empty, check if it's an untracked file and synthesize a read-only unified diff
    if bytes.is_empty() {
        let full = dir.join(rel_path);
        if full.is_file() {
            let raw = std::fs::read(&full)?;
            if raw.iter().take(8000).any(|&b| b == 0) {
                return Ok(FileDiffResult {
                    path: rel_path.to_string(),
                    is_binary: true,
                    truncated: false,
                    unified_diff: String::new(),
                });
            }
            let text = String::from_utf8_lossy(&raw);
            let mut synth = format!("--- /dev/null\n+++ b/{rel_path}\n@@ -0,0 +1,{} @@\n", text.lines().count());
            for line in text.lines() {
                synth.push('+');
                synth.push_str(line);
                synth.push('\n');
                if synth.len() > MAX_DIFF_BYTES {
                    return Ok(FileDiffResult {
                        path: rel_path.to_string(),
                        is_binary: false,
                        truncated: true,
                        unified_diff: synth[..MAX_DIFF_BYTES].to_string(),
                    });
                }
            }
            return Ok(FileDiffResult {
                path: rel_path.to_string(),
                is_binary: false,
                truncated: false,
                unified_diff: synth,
            });
        }
    }

    let truncated = bytes.len() > MAX_DIFF_BYTES;
    if truncated {
        bytes.truncate(MAX_DIFF_BYTES);
    }
    let text = String::from_utf8_lossy(&bytes).to_string();
    let is_binary = text.contains("Binary files ") && text.contains(" differ");

    Ok(FileDiffResult {
        path: rel_path.to_string(),
        is_binary,
        truncated,
        unified_diff: text,
    })
}

pub fn stage_files(dir: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        git_command(dir, &["add", "-A"])?;
        return Ok(());
    }
    let mut args = vec!["add", "--"];
    for p in paths {
        args.push(p.as_str());
    }
    git_command(dir, &args)?;
    Ok(())
}

pub fn unstage_files(dir: &Path, paths: &[String]) -> AppResult<()> {
    let mut args = vec!["reset", "HEAD", "--"];
    for p in paths {
        args.push(p.as_str());
    }
    git_command(dir, &args)?;
    Ok(())
}

pub fn commit_changes(dir: &Path, message: &str) -> AppResult<String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("Commit message cannot be empty".into()));
    }
    git_command(dir, &["commit", "-m", trimmed])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_diff_stage_and_commit_flow() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        git_command(p, &["init", "-b", "main"]).unwrap();
        git_command(p, &["config", "user.email", "test@cogmint.dev"]).unwrap();
        git_command(p, &["config", "user.name", "COGMINT Test"]).unwrap();
        std::fs::write(p.join("a.txt"), "hello\n").unwrap();
        git_command(p, &["add", "."]).unwrap();
        git_command(p, &["commit", "-m", "init"]).unwrap();

        std::fs::write(p.join("a.txt"), "hello\nnew line\n").unwrap();
        std::fs::write(p.join("b.txt"), "untracked\n").unwrap();

        let status = get_git_status(p).unwrap();
        assert!(status.is_git_repo);
        assert_eq!(status.changes.len(), 2);

        let diff = get_file_diff(p, "a.txt", false).unwrap();
        assert!(diff.unified_diff.contains("+new line"));

        stage_files(p, &[]).unwrap();
        commit_changes(p, "feat: add lines").unwrap();

        let after = get_git_status(p).unwrap();
        assert!(after.changes.is_empty());
    }
}
