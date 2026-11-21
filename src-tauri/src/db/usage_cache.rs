use crate::db::Database;
use crate::error::AppResult;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredUsageRecord {
    pub harness_id: String,
    pub session_id: String,
    pub message_id: String,
    pub project_path: Option<String>,
    pub model_id: String,
    pub timestamp_ms: i64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PricingOverrideRecord {
    pub model_id: String,
    pub provider: String,
    pub input_per_mtok: f64,
    pub output_per_mtok: f64,
    pub cache_read_per_mtok: f64,
    pub cache_write_per_mtok: f64,
}

impl Database {
    pub fn get_usage_file_offset(&self, path: &str) -> AppResult<Option<(u64, i64)>> {
        let conn = self.lock_conn()?;
        let res = conn
            .query_row(
                "SELECT byte_offset, mtime_ms FROM usage_files WHERE path = ?1",
                params![path],
                |row| Ok((row.get::<_, i64>(0)? as u64, row.get::<_, i64>(1)?)),
            )
            .optional()?;
        Ok(res)
    }

    pub fn set_usage_file_offset(
        &self,
        path: &str,
        harness_id: &str,
        byte_offset: u64,
        mtime_ms: i64,
    ) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT INTO usage_files (path, harness_id, byte_offset, mtime_ms)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET
               byte_offset = excluded.byte_offset,
               mtime_ms = excluded.mtime_ms",
            params![path, harness_id, byte_offset as i64, mtime_ms],
        )?;
        Ok(())
    }

    pub fn insert_usage_records(&self, records: &[StoredUsageRecord]) -> AppResult<()> {
        let mut conn = self.lock_conn()?;
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO usage_records (
                    harness_id, session_id, message_id, project_path, model_id,
                    timestamp_ms, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(harness_id, session_id, message_id) DO UPDATE SET
                    model_id = excluded.model_id,
                    timestamp_ms = excluded.timestamp_ms,
                    input_tokens = excluded.input_tokens,
                    output_tokens = excluded.output_tokens,
                    cache_read_tokens = excluded.cache_read_tokens,
                    cache_write_tokens = excluded.cache_write_tokens",
            )?;
            for rec in records {
                stmt.execute(params![
                    rec.harness_id,
                    rec.session_id,
                    rec.message_id,
                    rec.project_path,
                    rec.model_id,
                    rec.timestamp_ms,
                    rec.input_tokens as i64,
                    rec.output_tokens as i64,
                    rec.cache_read_tokens as i64,
                    rec.cache_write_tokens as i64,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn query_usage_records(&self, since_ms: i64) -> AppResult<Vec<StoredUsageRecord>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT harness_id, session_id, message_id, project_path, model_id,
                    timestamp_ms, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens
             FROM usage_records
             WHERE timestamp_ms >= ?1
             ORDER BY timestamp_ms ASC",
        )?;
        let rows = stmt.query_map(params![since_ms], |row| {
            Ok(StoredUsageRecord {
                harness_id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                project_path: row.get(3)?,
                model_id: row.get(4)?,
                timestamp_ms: row.get(5)?,
                input_tokens: row.get::<_, i64>(6)?.max(0) as u64,
                output_tokens: row.get::<_, i64>(7)?.max(0) as u64,
                cache_read_tokens: row.get::<_, i64>(8)?.max(0) as u64,
                cache_write_tokens: row.get::<_, i64>(9)?.max(0) as u64,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_pricing_override(&self, rec: &PricingOverrideRecord) -> AppResult<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT INTO pricing_overrides (model_id, provider, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(model_id) DO UPDATE SET
               provider = excluded.provider,
               input_per_mtok = excluded.input_per_mtok,
               output_per_mtok = excluded.output_per_mtok,
               cache_read_per_mtok = excluded.cache_read_per_mtok,
               cache_write_per_mtok = excluded.cache_write_per_mtok",
            params![
                rec.model_id,
                rec.provider,
                rec.input_per_mtok,
                rec.output_per_mtok,
                rec.cache_read_per_mtok,
                rec.cache_write_per_mtok,
            ],
        )?;
        Ok(())
    }

    pub fn list_pricing_overrides(&self) -> AppResult<Vec<PricingOverrideRecord>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            "SELECT model_id, provider, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok
             FROM pricing_overrides",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PricingOverrideRecord {
                model_id: row.get(0)?,
                provider: row.get(1)?,
                input_per_mtok: row.get(2)?,
                output_per_mtok: row.get(3)?,
                cache_read_per_mtok: row.get(4)?,
                cache_write_per_mtok: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_record_deduplicates_by_harness_and_message_id() {
        let db = Database::open_in_memory().unwrap();
        let rec1 = StoredUsageRecord {
            harness_id: "claude".into(),
            session_id: "sess-1".into(),
            message_id: "msg-42".into(),
            project_path: Some("/repo".into()),
            model_id: "claude-sonnet-4-5".into(),
            timestamp_ms: 1_700_000_000_000,
            input_tokens: 1_000,
            output_tokens: 200,
            cache_read_tokens: 500,
            cache_write_tokens: 0,
        };
        let mut rec2 = rec1.clone();
        rec2.output_tokens = 450;

        db.insert_usage_records(&[rec1]).unwrap();
        db.insert_usage_records(&[rec2.clone()]).unwrap();

        let all = db.query_usage_records(0).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].output_tokens, 450);
    }
}
