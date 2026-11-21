use crate::db::StoredUsageRecord;
use crate::error::AppResult;
use crate::usage::parsers::{parse_timestamp_ms, read_complete_lines_from};
use std::path::Path;

pub fn parse_codex_jsonl_incremental(
    path: &Path,
    start_offset: u64,
) -> AppResult<(Vec<StoredUsageRecord>, u64)> {
    let (lines, new_offset) = read_complete_lines_from(path, start_offset)?;
    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mut records = Vec::new();
    for (idx, line) in lines.iter().enumerate() {
        let Ok(val) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let usage = val
            .pointer("/payload/info/last_token_usage")
            .or_else(|| val.pointer("/payload/usage"))
            .or_else(|| val.get("usage"));
        let Some(usage) = usage else { continue };

        let input_tokens = usage
            .get("input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let output_tokens = usage
            .get("output_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let cache_read_tokens = usage
            .get("cached_input_tokens")
            .or_else(|| usage.get("cache_read_tokens"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if input_tokens == 0 && output_tokens == 0 && cache_read_tokens == 0 {
            continue;
        }

        let model_id = val
            .pointer("/payload/model")
            .or_else(|| val.get("model"))
            .and_then(|v| v.as_str())
            .unwrap_or("gpt-5-codex")
            .to_string();

        let message_id = val
            .get("id")
            .or_else(|| val.pointer("/payload/id"))
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| format!("codex-{start_offset}-{idx}"));

        let timestamp_ms = val
            .get("timestamp")
            .map(parse_timestamp_ms)
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

        records.push(StoredUsageRecord {
            harness_id: "codex".into(),
            session_id: session_id.clone(),
            message_id,
            project_path: None,
            model_id,
            timestamp_ms,
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_write_tokens: 0,
        });
    }

    Ok((records, new_offset))
}
