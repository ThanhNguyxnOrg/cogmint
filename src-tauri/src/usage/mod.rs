pub mod parsers;
pub mod pricing;

use crate::db::Database;
use crate::error::AppResult;
use crate::usage::parsers::claude::parse_claude_jsonl_incremental;
use crate::usage::parsers::codex::parse_codex_jsonl_incremental;
use crate::usage::parsers::opencode::parse_opencode_logs;
use crate::usage::pricing::PricingCatalog;
use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessUsage {
    pub harness_id: String,
    pub cost_usd: f64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub message_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model_id: String,
    pub cost_usd: f64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DailySpend {
    pub date: String,
    pub cost_usd: f64,
    pub by_harness: BTreeMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageSummary {
    pub total_cost_usd: f64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_cache_write_tokens: u64,
    pub by_harness: Vec<HarnessUsage>,
    pub by_model: Vec<ModelUsage>,
    pub by_day: Vec<DailySpend>,
    pub pricing_updated_at: String,
}

fn file_mtime_ms(path: &Path) -> i64 {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn collect_jsonl_files(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 || !dir.exists() {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            collect_jsonl_files(&p, depth - 1, out);
        } else if p.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            out.push(p);
        }
    }
}

/// Incrementally scans Claude Code, Codex, and OpenCode local log directories into SQLite cache.
pub fn scan_local_logs_into_db(db: &Database, home_dir: &Path) -> AppResult<()> {
    // 1. Claude Code (~/.claude/projects/**/*.jsonl)
    let mut claude_files = Vec::new();
    collect_jsonl_files(&home_dir.join(".claude").join("projects"), 3, &mut claude_files);
    for file in claude_files {
        let path_str = file.to_string_lossy().to_string();
        let mtime = file_mtime_ms(&file);
        let prev = db.get_usage_file_offset(&path_str)?;
        if let Some((_, prev_mtime)) = prev {
            if prev_mtime == mtime {
                continue;
            }
        }
        let start_offset = prev.map(|(off, _)| off).unwrap_or(0);
        if let Ok((recs, new_off)) = parse_claude_jsonl_incremental(&file, start_offset) {
            if !recs.is_empty() {
                db.insert_usage_records(&recs)?;
            }
            db.set_usage_file_offset(&path_str, "claude", new_off, mtime)?;
        }
    }

    // 2. Codex (~/.codex/sessions/**/*.jsonl)
    let mut codex_files = Vec::new();
    collect_jsonl_files(&home_dir.join(".codex").join("sessions"), 4, &mut codex_files);
    for file in codex_files {
        let path_str = file.to_string_lossy().to_string();
        let mtime = file_mtime_ms(&file);
        let prev = db.get_usage_file_offset(&path_str)?;
        if let Some((_, prev_mtime)) = prev {
            if prev_mtime == mtime {
                continue;
            }
        }
        let start_offset = prev.map(|(off, _)| off).unwrap_or(0);
        if let Ok((recs, new_off)) = parse_codex_jsonl_incremental(&file, start_offset) {
            if !recs.is_empty() {
                db.insert_usage_records(&recs)?;
            }
            db.set_usage_file_offset(&path_str, "codex", new_off, mtime)?;
        }
    }

    // 3. OpenCode (~/.local/share/opencode/storage/message)
    let opencode_dir = home_dir
        .join(".local")
        .join("share")
        .join("opencode")
        .join("storage")
        .join("message");
    if opencode_dir.exists() {
        if let Ok(recs) = parse_opencode_logs(&opencode_dir) {
            if !recs.is_empty() {
                db.insert_usage_records(&recs)?;
            }
        }
    }

    Ok(())
}

/// Aggregates real usage records from SQLite for the last `days` days. Returns zero/empty with NO mock data.
pub fn aggregate_usage(
    db: &Database,
    catalog: &PricingCatalog,
    days: u32,
) -> AppResult<UsageSummary> {
    let now_ms = Utc::now().timestamp_millis();
    let window_ms = (days.max(1) as i64) * 86_400_000;
    let since_ms = now_ms.saturating_sub(window_ms);

    let records = db.query_usage_records(since_ms)?;

    let mut total_cost = 0.0;
    let mut total_in = 0u64;
    let mut total_out = 0u64;
    let mut total_cr = 0u64;
    let mut total_cw = 0u64;

    let mut harness_map: BTreeMap<String, HarnessUsage> = BTreeMap::new();
    let mut model_map: BTreeMap<String, ModelUsage> = BTreeMap::new();
    let mut day_map: BTreeMap<String, DailySpend> = BTreeMap::new();

    for rec in records {
        let cost = catalog.compute_cost(&rec);
        total_cost += cost;
        total_in += rec.input_tokens;
        total_out += rec.output_tokens;
        total_cr += rec.cache_read_tokens;
        total_cw += rec.cache_write_tokens;

        let h = harness_map
            .entry(rec.harness_id.clone())
            .or_insert_with(|| HarnessUsage {
                harness_id: rec.harness_id.clone(),
                cost_usd: 0.0,
                input_tokens: 0,
                output_tokens: 0,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                message_count: 0,
            });
        h.cost_usd += cost;
        h.input_tokens += rec.input_tokens;
        h.output_tokens += rec.output_tokens;
        h.cache_read_tokens += rec.cache_read_tokens;
        h.cache_write_tokens += rec.cache_write_tokens;
        h.message_count += 1;

        let m = model_map
            .entry(rec.model_id.clone())
            .or_insert_with(|| ModelUsage {
                model_id: rec.model_id.clone(),
                cost_usd: 0.0,
                input_tokens: 0,
                output_tokens: 0,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
            });
        m.cost_usd += cost;
        m.input_tokens += rec.input_tokens;
        m.output_tokens += rec.output_tokens;
        m.cache_read_tokens += rec.cache_read_tokens;
        m.cache_write_tokens += rec.cache_write_tokens;

        let date = Utc
            .timestamp_millis_opt(rec.timestamp_ms)
            .single()
            .unwrap_or_else(Utc::now)
            .format("%Y-%m-%d")
            .to_string();
        let d = day_map.entry(date.clone()).or_insert_with(|| DailySpend {
            date,
            cost_usd: 0.0,
            by_harness: BTreeMap::new(),
        });
        d.cost_usd += cost;
        *d.by_harness.entry(rec.harness_id).or_insert(0.0) += cost;
    }

    let mut by_harness: Vec<_> = harness_map.into_values().collect();
    by_harness.sort_by(|a, b| b.cost_usd.total_cmp(&a.cost_usd));

    let mut by_model: Vec<_> = model_map.into_values().collect();
    by_model.sort_by(|a, b| b.cost_usd.total_cmp(&a.cost_usd));

    let by_day: Vec<_> = day_map.into_values().collect();

    Ok(UsageSummary {
        total_cost_usd: total_cost,
        total_input_tokens: total_in,
        total_output_tokens: total_out,
        total_cache_read_tokens: total_cr,
        total_cache_write_tokens: total_cw,
        by_harness,
        by_model,
        by_day,
        pricing_updated_at: catalog.updated_at.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_summary_returns_zero_with_no_mock_data_when_empty() {
        let db = Database::open_in_memory().unwrap();
        let summary = aggregate_usage(&db, &PricingCatalog::bundled(), 30).unwrap();
        assert_eq!(summary.total_cost_usd, 0.0);
        assert!(summary.by_day.is_empty());
        assert!(summary.by_harness.is_empty());
        assert!(summary.by_model.is_empty());
    }
}
