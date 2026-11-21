pub mod claude;
pub mod codex;
pub mod opencode;

use crate::error::AppResult;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Reads complete newline-terminated lines from `path` starting at `start_offset`.
/// Never advances the returned offset past an incomplete trailing line (live-written file safety).
pub fn read_complete_lines_from(path: &Path, start_offset: u64) -> AppResult<(Vec<String>, u64)> {
    let mut file = std::fs::File::open(path)?;
    let file_len = file.metadata()?.len();
    let effective_start = if start_offset > file_len { 0 } else { start_offset };
    file.seek(SeekFrom::Start(effective_start))?;

    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;

    let Some(last_nl) = buf.iter().rposition(|&b| b == b'\n') else {
        return Ok((Vec::new(), effective_start));
    };

    let complete_slice = &buf[..=last_nl];
    let text = String::from_utf8_lossy(complete_slice);
    let lines = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok((lines, effective_start + (last_nl as u64) + 1))
}

pub fn parse_timestamp_ms(val: &serde_json::Value) -> i64 {
    if let Some(n) = val.as_i64() {
        return if n < 10_000_000_000 { n * 1000 } else { n };
    }
    if let Some(s) = val.as_str() {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
            return dt.timestamp_millis();
        }
    }
    chrono::Utc::now().timestamp_millis()
}
