use crate::db::StoredUsageRecord;
use crate::error::AppResult;
use crate::usage::parsers::parse_timestamp_ms;
use std::path::Path;

/// Scans OpenCode local JSON message logs under `~/.local/share/opencode/storage/message`.
pub fn parse_opencode_logs(base_dir: &Path) -> AppResult<Vec<StoredUsageRecord>> {
    let mut records = Vec::new();
    if !base_dir.exists() {
        return Ok(records);
    }
    collect_json_files(base_dir, 4, &mut records);
    Ok(records)
}

fn collect_json_files(dir: &Path, depth: usize, out: &mut Vec<StoredUsageRecord>) {
    if depth == 0 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_json_files(&path, depth - 1, out);
        } else if path.extension().and_then(|e| e.to_str()) == Some("json") {
            let Ok(raw) = std::fs::read_to_string(&path) else {
                continue;
            };
            let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) else {
                continue;
            };
            let Some(tokens) = val.get("tokens") else {
                continue;
            };
            let input_tokens = tokens.get("input").and_then(|v| v.as_u64()).unwrap_or(0);
            let output_tokens = tokens.get("output").and_then(|v| v.as_u64()).unwrap_or(0);
            let cache_read_tokens = tokens
                .pointer("/cache/read")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let cache_write_tokens = tokens
                .pointer("/cache/write")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            if input_tokens == 0 && output_tokens == 0 && cache_read_tokens == 0 {
                continue;
            }
            let session_id = val
                .get("sessionID")
                .and_then(|v| v.as_str())
                .unwrap_or("opencode")
                .to_string();
            let message_id = val
                .get("id")
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_else(|| {
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("msg")
                        .to_string()
                });
            let model_id = val
                .get("modelID")
                .and_then(|v| v.as_str())
                .unwrap_or("claude-sonnet-4-5")
                .to_string();
            let timestamp_ms = val
                .pointer("/time/created")
                .map(parse_timestamp_ms)
                .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

            out.push(StoredUsageRecord {
                harness_id: "opencode".into(),
                session_id,
                message_id,
                project_path: None,
                model_id,
                timestamp_ms,
                input_tokens,
                output_tokens,
                cache_read_tokens,
                cache_write_tokens,
            });
        }
    }
}
