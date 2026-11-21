use std::io::{BufRead, BufReader};
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

fn newest_jsonl_recursive(
    dir: &Path,
    max_depth: usize,
    session_id: &impl Fn(&Path) -> Option<String>,
) -> Option<(SystemTime, String)> {
    if max_depth == 0 {
        return None;
    }
    let entries = std::fs::read_dir(dir).ok()?;
    let mut best: Option<(SystemTime, String)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(sub) = newest_jsonl_recursive(&path, max_depth - 1, session_id) {
                if best.as_ref().map(|(t, _)| sub.0 > *t).unwrap_or(true) {
                    best = Some(sub);
                }
            }
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            let mtime = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
                if let Some(id) = session_id(&path) {
                    best = Some((mtime, id));
                }
            }
        }
    }
    best
}

fn codex_session_id(path: &Path, cwd: &Path) -> Option<String> {
    #[derive(serde::Deserialize)]
    #[serde(tag = "type", content = "payload", rename_all = "snake_case")]
    enum Header {
        SessionMeta { id: String, cwd: PathBuf },
    }

    if !path.is_file() {
        return None;
    }
    let file = std::fs::File::open(path).ok()?;
    let header = BufReader::new(file).lines().next()?.ok()?;
    let Header::SessionMeta { id, cwd: recorded } = serde_json::from_str(&header).ok()?;
    if !recorded.is_absolute()
        || (recorded != cwd && recorded.canonicalize().ok().as_deref() != Some(cwd))
    {
        return None;
    }
    uuid::Uuid::parse_str(&id).ok().map(|id| id.to_string())
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
            let cwd = cwd.canonicalize().unwrap_or_else(|_| cwd.to_owned());
            newest_jsonl_recursive(&sessions_dir, 4, &|path| codex_session_id(path, &cwd))
                .map(|(_, id)| id)
        }
        "opencode" => {
            let storage = home_dir
                .join(".local")
                .join("share")
                .join("opencode")
                .join("storage")
                .join("session");
            newest_jsonl_recursive(&storage, 3, &|path| {
                Some(path.file_stem()?.to_str()?.into())
            })
            .map(|(_, stem)| stem)
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

    fn write_rollout(home: &Path, day: &str, cwd: &Path, mtime: u64) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let dir = home.join(".codex/sessions/2026/11").join(day);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(format!("rollout-2026-11-{day}T12-00-00-{id}.jsonl"));
        let header = serde_json::json!({"type": "session_meta", "payload": {"cwd": cwd, "id": id}});
        std::fs::write(&path, format!("{header}\n{{}}\n")).unwrap();
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(mtime))
            .unwrap();
        id
    }

    #[test]
    fn codex_resumes_newest_session_in_requested_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let cwd = tmp.path().join("project");
        std::fs::create_dir_all(cwd.join("nested")).unwrap();
        write_rollout(tmp.path(), "20", &cwd, 1);
        let latest = write_rollout(tmp.path(), "21", &cwd, 2);
        write_rollout(tmp.path(), "21", &cwd.join("nested"), 3);

        assert_eq!(
            resolve_latest_session_id("codex", &cwd, tmp.path()),
            Some(latest)
        );
    }

    #[test]
    fn codex_returns_none_without_a_matching_session_header() {
        let tmp = tempfile::tempdir().unwrap();
        let cwd = tmp.path().join("project");
        let id = write_rollout(tmp.path(), "21", &tmp.path().join("other"), 1);
        let dir = tmp.path().join(".codex/sessions/2026/11/21");
        std::fs::write(dir.join("broken.jsonl"), "not JSON\n").unwrap();
        std::fs::write(
            dir.join("no-cwd.jsonl"),
            serde_json::json!({
                "type": "session_meta", "payload": {"id": id}
            })
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            dir.join("event.jsonl"),
            serde_json::json!({
                "type": "event_msg", "payload": {"cwd": cwd, "id": id}
            })
            .to_string(),
        )
        .unwrap();

        assert_eq!(resolve_latest_session_id("codex", &cwd, tmp.path()), None);
    }

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
