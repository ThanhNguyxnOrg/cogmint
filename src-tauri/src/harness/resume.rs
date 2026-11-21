use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Encodes a workspace path the way Claude Code names project directories under ~/.claude/projects/
pub fn encode_claude_project_dir(cwd: &Path) -> String {
    let raw = cwd.to_string_lossy();
    raw.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else {
                '-'
            }
        })
        .collect()
}

fn newest_file_stem_in_dir(dir: &Path, ext: &str) -> Option<(String, PathBuf)> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut best: Option<(SystemTime, String, PathBuf)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some(ext) {
            continue;
        }
        let stem = path.file_stem()?.to_str()?.to_string();
        let mtime = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        if best.as_ref().map(|(t, _, _)| mtime > *t).unwrap_or(true) {
            best = Some((mtime, stem, path));
        }
    }
    best.map(|(_, stem, path)| (stem, path))
}

fn newest_jsonl_recursive(dir: &Path, max_depth: usize) -> Option<(SystemTime, String, PathBuf)> {
    if max_depth == 0 {
        return None;
    }
    let entries = std::fs::read_dir(dir).ok()?;
    let mut best: Option<(SystemTime, String, PathBuf)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(sub) = newest_jsonl_recursive(&path, max_depth - 1) {
                if best.as_ref().map(|(t, _, _)| sub.0 > *t).unwrap_or(true) {
                    best = Some(sub);
                }
            }
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                let mtime = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .unwrap_or(SystemTime::UNIX_EPOCH);
                if best.as_ref().map(|(t, _, _)| mtime > *t).unwrap_or(true) {
                    best = Some((mtime, stem.to_string(), path));
                }
            }
        }
    }
    best
}

pub fn resolve_latest_session_id(harness_id: &str, cwd: &Path, home_dir: &Path) -> Option<String> {
    match harness_id {
        "claude" => {
            let encoded = encode_claude_project_dir(cwd);
            let proj_dir = home_dir.join(".claude").join("projects").join(encoded);
            newest_file_stem_in_dir(&proj_dir, "jsonl").map(|(stem, _)| stem)
        }
        "codex" => {
            let sessions_dir = home_dir.join(".codex").join("sessions");
            newest_jsonl_recursive(&sessions_dir, 4).map(|(_, stem, _)| stem)
        }
        "opencode" => {
            let storage = home_dir
                .join(".local")
                .join("share")
                .join("opencode")
                .join("storage")
                .join("session");
            newest_jsonl_recursive(&storage, 3).map(|(_, stem, _)| stem)
        }
        "gemini" => Some("latest".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_resolve_latest_claude_session_from_fixture_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let cwd = PathBuf::from("/repos/cogmint");
        let encoded = encode_claude_project_dir(&cwd);
        let proj_dir = tmp.path().join(".claude").join("projects").join(encoded);
        std::fs::create_dir_all(&proj_dir).unwrap();

        std::fs::write(proj_dir.join("older-session.jsonl"), "{}\n").unwrap();
        thread::sleep(Duration::from_millis(30));
        std::fs::write(proj_dir.join("newest-session.jsonl"), "{}\n").unwrap();

        let resolved = resolve_latest_session_id("claude", &cwd, tmp.path());
        assert_eq!(resolved.as_deref(), Some("newest-session"));
    }
}
