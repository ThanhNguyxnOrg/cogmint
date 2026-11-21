use crate::db::StoredUsageRecord;
use crate::error::AppResult;
use crate::usage::parsers::{parse_timestamp_ms, read_complete_lines_from};
use std::path::Path;

pub fn parse_claude_jsonl_incremental(
    path: &Path,
    start_offset: u64,
) -> AppResult<(Vec<StoredUsageRecord>, u64)> {
    let (lines, new_offset) = read_complete_lines_from(path, start_offset)?;
    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
    let project_path = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .map(String::from);

    let mut records = Vec::new();
    for (idx, line) in lines.iter().enumerate() {
        let Ok(val) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let usage = val.pointer("/message/usage").or_else(|| val.get("usage"));
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
            .get("cache_read_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let cache_write_tokens = usage
            .get("cache_creation_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if input_tokens == 0
            && output_tokens == 0
            && cache_read_tokens == 0
            && cache_write_tokens == 0
        {
            continue;
        }

        let model_id = val
            .pointer("/message/model")
            .or_else(|| val.get("model"))
            .and_then(|v| v.as_str())
            .unwrap_or("claude-sonnet-4-5")
            .to_string();

        let message_id = val
            .pointer("/message/id")
            .or_else(|| val.get("requestId"))
            .or_else(|| val.get("uuid"))
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| format!("line-{start_offset}-{idx}"));

        let timestamp_ms = val
            .get("timestamp")
            .map(parse_timestamp_ms)
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

        records.push(StoredUsageRecord {
            harness_id: "claude".into(),
            session_id: session_id.clone(),
            message_id,
            project_path: project_path.clone(),
            model_id,
            timestamp_ms,
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_write_tokens,
        });
    }

    Ok((records, new_offset))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    #[test]
    fn test_claude_parser_handles_truncated_line_and_deduplicates_request_id() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("sess-abc.jsonl");
        let line1 = r#"{"timestamp":"2026-11-21T01:00:00Z","message":{"id":"msg_01","model":"claude-sonnet-4-5","usage":{"input_tokens":1000,"output_tokens":50,"cache_read_input_tokens":200,"cache_creation_input_tokens":0}}}"#;
        let line2 = r#"{"timestamp":"2026-11-21T01:00:01Z","message":{"id":"msg_01","model":"claude-sonnet-4-5","usage":{"input_tokens":1000,"output_tokens":180,"cache_read_input_tokens":200,"cache_creation_input_tokens":0}}}"#;
        let truncated = r#"{"timestamp":"2026-11-21T01:00:02Z","message":{"id":"msg_02","model":"clau"#;

        let raw = format!("{line1}\n{line2}\n{truncated}");
        std::fs::write(&file, &raw).unwrap();

        let (records, offset) = parse_claude_jsonl_incremental(&file, 0).unwrap();
        assert_eq!(records.len(), 2);
        // Offset must stop right after line2's '\n', NOT consuming the truncated tail
        assert_eq!(offset as usize, line1.len() + 1 + line2.len() + 1);

        let db = Database::open_in_memory().unwrap();
        db.insert_usage_records(&records).unwrap();
        let stored = db.query_usage_records(0).unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].output_tokens, 180);
    }
}
