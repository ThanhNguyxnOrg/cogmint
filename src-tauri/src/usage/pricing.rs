use crate::db::{PricingOverrideRecord, StoredUsageRecord};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

const BUNDLED_PRICING_JSON: &str = include_str!("../../resources/pricing.json");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelPrice {
    #[serde(alias = "model_id")]
    pub model_id: String,
    pub provider: String,
    #[serde(alias = "input_per_mtok")]
    pub input_per_mtok: f64,
    #[serde(alias = "output_per_mtok")]
    pub output_per_mtok: f64,
    #[serde(alias = "cache_read_per_mtok")]
    pub cache_read_per_mtok: f64,
    #[serde(alias = "cache_write_per_mtok")]
    pub cache_write_per_mtok: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingFile {
    pub updated_at: String,
    pub models: Vec<ModelPrice>,
}

#[derive(Debug, Clone)]
pub struct PricingCatalog {
    pub updated_at: String,
    prices: HashMap<String, ModelPrice>,
    overrides: HashMap<String, ModelPrice>,
}

impl PricingCatalog {
    pub fn bundled() -> Self {
        let parsed: PricingFile = serde_json::from_str(BUNDLED_PRICING_JSON)
            .expect("bundled pricing.json must be valid JSON");
        let mut prices = HashMap::new();
        for m in parsed.models {
            prices.insert(m.model_id.to_lowercase(), m);
        }
        Self {
            updated_at: parsed.updated_at,
            prices,
            overrides: HashMap::new(),
        }
    }

    pub fn load_with_cache(cache_path: &Path, overrides: Vec<PricingOverrideRecord>) -> Self {
        let mut catalog = if let Ok(raw) = std::fs::read_to_string(cache_path) {
            if let Ok(parsed) = serde_json::from_str::<PricingFile>(&raw) {
                let mut prices = HashMap::new();
                for m in parsed.models {
                    prices.insert(m.model_id.to_lowercase(), m);
                }
                Self {
                    updated_at: parsed.updated_at,
                    prices,
                    overrides: HashMap::new(),
                }
            } else {
                Self::bundled()
            }
        } else {
            Self::bundled()
        };

        for ov in overrides {
            catalog.overrides.insert(
                ov.model_id.to_lowercase(),
                ModelPrice {
                    model_id: ov.model_id,
                    provider: ov.provider,
                    input_per_mtok: ov.input_per_mtok,
                    output_per_mtok: ov.output_per_mtok,
                    cache_read_per_mtok: ov.cache_read_per_mtok,
                    cache_write_per_mtok: ov.cache_write_per_mtok,
                },
            );
        }
        catalog
    }

    pub fn all_prices(&self) -> Vec<ModelPrice> {
        let mut merged = self.prices.clone();
        for (k, v) in &self.overrides {
            merged.insert(k.clone(), v.clone());
        }
        let mut list: Vec<_> = merged.into_values().collect();
        list.sort_by(|a, b| a.provider.cmp(&b.provider).then(a.model_id.cmp(&b.model_id)));
        list
    }

    /// Resolves raw model ID: user override → exact match → stripped date suffix → family prefix match.
    pub fn resolve(&self, raw_model: &str) -> Option<&ModelPrice> {
        let key = raw_model.trim().to_lowercase();
        if let Some(p) = self.overrides.get(&key) {
            return Some(p);
        }
        if let Some(p) = self.prices.get(&key) {
            return Some(p);
        }

        // Strip trailing date suffix like `-20250929`
        let stripped = strip_date_suffix(&key);
        if let Some(p) = self.overrides.get(stripped).or_else(|| self.prices.get(stripped)) {
            return Some(p);
        }

        // Longest prefix match in overrides then bundled prices
        for map in [&self.overrides, &self.prices] {
            if let Some((_, best)) = map
                .iter()
                .filter(|(k, _)| stripped.starts_with(k.as_str()) || k.starts_with(stripped))
                .max_by_key(|(k, _)| k.len())
            {
                return Some(best);
            }
        }

        // Family fallback
        if key.contains("opus") {
            return self.prices.get("claude-opus-4-5");
        }
        if key.contains("sonnet") {
            return self.prices.get("claude-sonnet-4-5");
        }
        if key.contains("haiku") {
            return self.prices.get("claude-haiku-4-5");
        }
        if key.contains("codex") || key.contains("gpt-5") {
            return self.prices.get("gpt-5-codex");
        }
        if key.contains("gemini") && key.contains("flash") {
            return self.prices.get("gemini-2.5-flash");
        }
        if key.contains("gemini") {
            return self.prices.get("gemini-2.5-pro");
        }
        None
    }

    pub fn compute_cost(&self, rec: &StoredUsageRecord) -> f64 {
        let Some(price) = self.resolve(&rec.model_id) else {
            return 0.0;
        };
        const M: f64 = 1_000_000.0;
        (rec.input_tokens as f64 / M) * price.input_per_mtok
            + (rec.output_tokens as f64 / M) * price.output_per_mtok
            + (rec.cache_read_tokens as f64 / M) * price.cache_read_per_mtok
            + (rec.cache_write_tokens as f64 / M) * price.cache_write_per_mtok
    }
}

fn strip_date_suffix(model: &str) -> &str {
    if let Some((prefix, suffix)) = model.rsplit_once('-') {
        if suffix.len() == 8 && suffix.chars().all(|c| c.is_ascii_digit()) {
            return prefix;
        }
    }
    model
}

/// Optional unauthenticated HTTPS refresh from a public pricing JSON URL (never sends CLI auth).
pub async fn refresh_pricing_file(url: &str, cache_path: &Path) -> AppResult<PricingFile> {
    let resp = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::External(format!("HTTP client error: {e}")))?
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::External(format!("Pricing fetch failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::External(format!(
            "Pricing endpoint returned HTTP {}",
            resp.status()
        )));
    }

    let parsed: PricingFile = resp
        .json()
        .await
        .map_err(|e| AppError::External(format!("Invalid pricing JSON schema: {e}")))?;

    if parsed.models.is_empty() {
        return Err(AppError::External("Fetched pricing catalog is empty".into()));
    }

    if let Some(parent) = cache_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = cache_path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(&parsed).unwrap_or_default())?;
    std::fs::rename(&tmp, cache_path)?;
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_rec() -> StoredUsageRecord {
        StoredUsageRecord {
            harness_id: "claude".into(),
            session_id: "s1".into(),
            message_id: "m1".into(),
            project_path: None,
            model_id: "claude-sonnet-4-5-20250929".into(),
            timestamp_ms: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
        }
    }

    #[test]
    fn test_pricing_resolves_dated_model_ids_and_computes_cache_costs() {
        let cat = PricingCatalog::bundled();
        let price = cat
            .resolve("claude-sonnet-4-5-20250929")
            .expect("sonnet price");
        let cost = cat.compute_cost(&StoredUsageRecord {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_read_tokens: 1_000_000,
            cache_write_tokens: 0,
            model_id: "claude-sonnet-4-5-20250929".into(),
            ..default_rec()
        });
        assert!(
            (cost - (price.input_per_mtok + price.output_per_mtok + price.cache_read_per_mtok))
                .abs()
                < 1e-6
        );
    }
}
