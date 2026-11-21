use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthStatus {
    Authenticated,
    Unauthenticated,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    CogmintProfile,
    EnvVar,
    OauthFile,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessAuthInfo {
    pub status: AuthStatus,
    pub method: AuthMethod,
    pub detail: Option<String>,
    pub login_command: Vec<String>,
    pub api_key_env: Option<String>,
    pub base_url_env: Option<String>,
    pub supports_oauth: bool,
    pub auth_notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessAuthProfile {
    pub harness_id: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    #[serde(default)]
    pub extra_env: HashMap<String, String>,
    pub use_custom_env: bool,
}

/// Frontend-safe representation of a saved profile (never exposes raw API keys).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessAuthProfileSummary {
    pub harness_id: String,
    pub has_api_key: bool,
    pub api_key_preview: Option<String>,
    pub base_url: Option<String>,
    pub extra_env: HashMap<String, String>,
    pub use_custom_env: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveHarnessAuthProfileRequest {
    pub harness_id: String,
    /// If `Some(non_empty)`, replaces stored API key. If `None`, keeps existing key unless `clear_api_key` is true.
    pub api_key: Option<String>,
    #[serde(default)]
    pub clear_api_key: bool,
    pub base_url: Option<String>,
    #[serde(default)]
    pub extra_env: HashMap<String, String>,
    pub use_custom_env: bool,
}

pub struct BuiltinAuthMeta {
    pub login_command: &'static [&'static str],
    pub api_key_env: Option<&'static str>,
    pub alt_api_key_envs: &'static [&'static str],
    pub base_url_env: Option<&'static str>,
    pub supports_oauth: bool,
    pub auth_notes: &'static str,
}

pub fn builtin_auth_meta(harness_id: &str) -> BuiltinAuthMeta {
    match harness_id {
        "claude" => BuiltinAuthMeta {
            login_command: &["claude", "auth", "login"],
            api_key_env: Some("ANTHROPIC_API_KEY"),
            alt_api_key_envs: &["ANTHROPIC_AUTH_TOKEN"],
            base_url_env: Some("ANTHROPIC_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Run `claude auth login` for Claude Pro/Max OAuth, or set ANTHROPIC_API_KEY & optional ANTHROPIC_BASE_URL gateway.",
        },
        "codex" => BuiltinAuthMeta {
            login_command: &["codex", "login"],
            api_key_env: Some("OPENAI_API_KEY"),
            alt_api_key_envs: &["CODEX_API_KEY", "CODEX_ACCESS_TOKEN"],
            base_url_env: Some("OPENAI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Run `codex login` for ChatGPT OAuth (or `--device-auth`), or set OPENAI_API_KEY & optional OPENAI_BASE_URL.",
        },
        "opencode" => BuiltinAuthMeta {
            login_command: &["opencode", "auth", "login"],
            api_key_env: Some("OPENROUTER_API_KEY"),
            alt_api_key_envs: &[
                "ANTHROPIC_API_KEY",
                "OPENAI_API_KEY",
                "GEMINI_API_KEY",
                "DEEPSEEK_API_KEY",
            ],
            base_url_env: Some("OPENAI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Run `opencode auth login` to connect any provider, or inject provider API keys (ANTHROPIC/OPENAI/GEMINI/OPENROUTER).",
        },
        "gemini" => BuiltinAuthMeta {
            login_command: &["gemini"],
            api_key_env: Some("GEMINI_API_KEY"),
            alt_api_key_envs: &["GOOGLE_API_KEY"],
            base_url_env: Some("GOOGLE_GEMINI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Launch `gemini` for Google OAuth sign-in, or set GEMINI_API_KEY (AI Studio) / GOOGLE_API_KEY (Vertex AI).",
        },
        "copilot" => BuiltinAuthMeta {
            login_command: &["gh", "auth", "login"],
            api_key_env: Some("GITHUB_TOKEN"),
            alt_api_key_envs: &["GH_TOKEN", "COPILOT_GITHUB_TOKEN"],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Authenticate via GitHub CLI (`gh auth login`) or set GITHUB_TOKEN / GH_TOKEN.",
        },
        "antigravity" => BuiltinAuthMeta {
            login_command: &["agy"],
            api_key_env: Some("GEMINI_API_KEY"),
            alt_api_key_envs: &["GOOGLE_API_KEY"],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Sign in with Google OAuth via `agy` or set GEMINI_API_KEY.",
        },
        "amp" => BuiltinAuthMeta {
            login_command: &["amp", "login"],
            api_key_env: Some("AMP_API_KEY"),
            alt_api_key_envs: &[],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Run `amp login` for Sourcegraph OAuth or set AMP_API_KEY.",
        },
        "kimi" => BuiltinAuthMeta {
            login_command: &["kimi", "login"],
            api_key_env: Some("MOONSHOT_API_KEY"),
            alt_api_key_envs: &["KIMI_API_KEY"],
            base_url_env: Some("OPENAI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Run `kimi login` or set MOONSHOT_API_KEY / KIMI_API_KEY.",
        },
        "kiro" => BuiltinAuthMeta {
            login_command: &["kiro-cli", "login"],
            api_key_env: None,
            alt_api_key_envs: &["AWS_ACCESS_KEY_ID", "AWS_PROFILE"],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Run `kiro-cli login` to sign in with AWS Builder ID or IAM Identity Center.",
        },
        "grok" => BuiltinAuthMeta {
            login_command: &[],
            api_key_env: Some("XAI_API_KEY"),
            alt_api_key_envs: &["GROK_API_KEY"],
            base_url_env: Some("GROK_BASE_URL"),
            supports_oauth: false,
            auth_notes: "Set XAI_API_KEY (and optional GROK_BASE_URL).",
        },
        "vibe" => BuiltinAuthMeta {
            login_command: &[],
            api_key_env: Some("MISTRAL_API_KEY"),
            alt_api_key_envs: &[],
            base_url_env: None,
            supports_oauth: false,
            auth_notes: "Set MISTRAL_API_KEY from Mistral Console.",
        },
        "droid" => BuiltinAuthMeta {
            login_command: &["droid"],
            api_key_env: Some("FACTORY_API_KEY"),
            alt_api_key_envs: &[],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Launch `droid` for interactive Factory sign-in or set FACTORY_API_KEY.",
        },
        "cursor" => BuiltinAuthMeta {
            login_command: &["cursor-agent", "login"],
            api_key_env: Some("CURSOR_API_KEY"),
            alt_api_key_envs: &[],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Run `cursor-agent login` for Cursor OAuth sign-in or set CURSOR_API_KEY.",
        },
        "aider" => BuiltinAuthMeta {
            login_command: &[],
            api_key_env: Some("OPENROUTER_API_KEY"),
            alt_api_key_envs: &[
                "ANTHROPIC_API_KEY",
                "OPENAI_API_KEY",
                "GEMINI_API_KEY",
                "DEEPSEEK_API_KEY",
            ],
            base_url_env: Some("OPENAI_API_BASE"),
            supports_oauth: false,
            auth_notes: "Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.",
        },
        "cline" => BuiltinAuthMeta {
            login_command: &["cline", "auth"],
            api_key_env: Some("OPENROUTER_API_KEY"),
            alt_api_key_envs: &["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"],
            base_url_env: Some("OPENAI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Run `cline auth` to connect your provider or inject provider API keys.",
        },
        "qwen" => BuiltinAuthMeta {
            login_command: &["qwen"],
            api_key_env: Some("OPENAI_API_KEY"),
            alt_api_key_envs: &["DASHSCOPE_API_KEY"],
            base_url_env: Some("OPENAI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Launch `qwen` for Qwen OAuth sign-in or set OPENAI_API_KEY / DASHSCOPE_API_KEY.",
        },
        "goose" => BuiltinAuthMeta {
            login_command: &["goose", "configure"],
            api_key_env: Some("ANTHROPIC_API_KEY"),
            alt_api_key_envs: &["OPENAI_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_API_KEY"],
            base_url_env: Some("OPENAI_HOST"),
            supports_oauth: false,
            auth_notes: "Run `goose configure` or inject ANTHROPIC_API_KEY / OPENAI_API_KEY.",
        },
        "kilo" => BuiltinAuthMeta {
            login_command: &["kilocode", "auth"],
            api_key_env: Some("KILOCODE_API_KEY"),
            alt_api_key_envs: &["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Run `kilocode auth` or set KILOCODE_API_KEY / OPENROUTER_API_KEY.",
        },
        "roocode" => BuiltinAuthMeta {
            login_command: &["roo", "auth"],
            api_key_env: Some("OPENROUTER_API_KEY"),
            alt_api_key_envs: &["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
            base_url_env: Some("OPENAI_BASE_URL"),
            supports_oauth: true,
            auth_notes: "Run `roo auth` or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY.",
        },
        "amazonq" => BuiltinAuthMeta {
            login_command: &["q", "login"],
            api_key_env: None,
            alt_api_key_envs: &["AWS_ACCESS_KEY_ID", "AWS_PROFILE"],
            base_url_env: None,
            supports_oauth: true,
            auth_notes: "Run `q login` to authenticate with AWS Builder ID or IAM Identity Center.",
        },
        _ => BuiltinAuthMeta {
            login_command: &[],
            api_key_env: None,
            alt_api_key_envs: &[],
            base_url_env: None,
            supports_oauth: false,
            auth_notes: "Configure custom environment variables (API keys, proxy URLs) injected when launching this CLI.",
        },
    }
}

pub fn mask_secret(secret: &str) -> String {
    let trimmed = secret.trim();
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() <= 8 {
        return "••••••••".into();
    }
    let prefix: String = chars.iter().take(4).collect();
    let suffix: String = chars.iter().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    format!("{prefix}••••{suffix}")
}

impl HarnessAuthProfile {
    pub fn to_summary(&self) -> HarnessAuthProfileSummary {
        let non_empty_key = self
            .api_key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        HarnessAuthProfileSummary {
            harness_id: self.harness_id.clone(),
            has_api_key: non_empty_key.is_some(),
            api_key_preview: non_empty_key.map(mask_secret),
            base_url: self.base_url.clone().filter(|s| !s.trim().is_empty()),
            extra_env: self.extra_env.clone(),
            use_custom_env: self.use_custom_env,
        }
    }
}

fn non_empty_file(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|m| m.is_file() && m.len() > 2)
        .unwrap_or(false)
}

fn non_empty_dir(path: &Path) -> bool {
    std::fs::read_dir(path)
        .map(|mut rd| rd.next().is_some())
        .unwrap_or(false)
}

fn local_oauth_credential_detail(harness_id: &str, home_dir: &Path) -> Option<String> {
    let data_local = dirs::data_local_dir();
    let config_dir = dirs::config_dir();

    match harness_id {
        "claude" => {
            let candidates = [
                home_dir.join(".claude").join(".credentials.json"),
                home_dir.join(".claude").join("credentials.json"),
            ];
            for p in candidates {
                if non_empty_file(&p) {
                    return Some("~/.claude/.credentials.json".into());
                }
            }
            // Check ~/.claude.json for an oauthAccount block without exposing tokens
            let claude_json = home_dir.join(".claude.json");
            if let Ok(raw) = std::fs::read_to_string(&claude_json) {
                if raw.contains("\"oauthAccount\"") {
                    return Some("~/.claude.json (OAuth)".into());
                }
            }
            None
        }
        "codex" => {
            let codex_home = std::env::var("CODEX_HOME")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| home_dir.join(".codex"));
            if non_empty_file(&codex_home.join("auth.json")) {
                return Some("~/.codex/auth.json".into());
            }
            None
        }
        "opencode" => {
            let mut candidates = vec![home_dir.join(".local/share/opencode/auth.json")];
            if let Some(ref d) = data_local {
                candidates.push(d.join("opencode").join("auth.json"));
            }
            for p in candidates {
                if non_empty_file(&p) {
                    return Some("opencode/auth.json".into());
                }
            }
            None
        }
        "gemini" => {
            for name in ["oauth_creds.json", "google_accounts.json"] {
                if non_empty_file(&home_dir.join(".gemini").join(name)) {
                    return Some(format!("~/.gemini/{name}"));
                }
            }
            None
        }
        "copilot" => {
            let mut candidates = vec![
                home_dir.join(".config/gh/hosts.yml"),
                home_dir.join(".copilot/config.json"),
            ];
            if let Some(ref c) = config_dir {
                candidates.push(c.join("GitHub CLI").join("hosts.yml"));
                candidates.push(c.join("gh").join("hosts.yml"));
            }
            for p in candidates {
                if non_empty_file(&p) {
                    return Some("GitHub CLI / Copilot OAuth".into());
                }
            }
            None
        }
        "antigravity" => {
            let candidates = [
                home_dir.join(".gemini/antigravity/oauth_creds.json"),
                home_dir.join(".gemini/oauth_creds.json"),
            ];
            for p in candidates {
                if non_empty_file(&p) {
                    return Some("Antigravity OAuth".into());
                }
            }
            None
        }
        "amp" => {
            let mut candidates = vec![home_dir.join(".local/share/amp/secrets.json")];
            if let Some(ref d) = data_local {
                candidates.push(d.join("amp").join("secrets.json"));
            }
            for p in candidates {
                if non_empty_file(&p) {
                    return Some("amp/secrets.json".into());
                }
            }
            None
        }
        "kimi" => {
            for rel in [".kimi/credentials.json", ".kimi/config.toml"] {
                if non_empty_file(&home_dir.join(rel)) {
                    return Some(format!("~/{rel}"));
                }
            }
            None
        }
        "kiro" => {
            if non_empty_dir(&home_dir.join(".kiro")) {
                return Some("~/.kiro".into());
            }
            None
        }
        "droid" => {
            if non_empty_file(&home_dir.join(".factory/auth.json"))
                || non_empty_file(&home_dir.join(".factory/credentials.json"))
            {
                return Some("~/.factory auth".into());
            }
            None
        }
        "cursor" => {
            if non_empty_file(&home_dir.join(".cursor/cli-config.json"))
                || non_empty_file(&home_dir.join(".cursor/auth.json"))
            {
                return Some("~/.cursor auth".into());
            }
            None
        }
        "qwen" => {
            if non_empty_file(&home_dir.join(".qwen/oauth_creds.json")) {
                return Some("~/.qwen/oauth_creds.json".into());
            }
            None
        }
        "goose" => {
            if non_empty_file(&home_dir.join(".config/goose/config.yaml")) {
                return Some("~/.config/goose/config.yaml".into());
            }
            None
        }
        "amazonq" => {
            if non_empty_dir(&home_dir.join(".aws/sso/cache")) {
                return Some("AWS Builder ID / SSO".into());
            }
            None
        }
        _ => None,
    }
}

pub fn detect_harness_auth_with_env<F>(
    harness_id: &str,
    home_dir: Option<&Path>,
    profile: Option<&HarnessAuthProfile>,
    env_lookup: F,
) -> HarnessAuthInfo
where
    F: Fn(&str) -> Option<String>,
{
    let meta = builtin_auth_meta(harness_id);
    let login_command = meta.login_command.iter().map(|s| (*s).to_string()).collect();
    let api_key_env = meta.api_key_env.map(String::from);
    let base_url_env = meta.base_url_env.map(String::from);
    let auth_notes = meta.auth_notes.to_string();

    // 1. Check COGMINT-managed profile override first
    if let Some(prof) = profile.filter(|p| p.use_custom_env) {
        let has_key = prof
            .api_key
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let has_extra = prof
            .extra_env
            .iter()
            .any(|(k, v)| !k.trim().is_empty() && !v.trim().is_empty());
        if has_key || has_extra {
            let detail = if has_key {
                api_key_env
                    .as_deref()
                    .map(|k| format!("COGMINT Profile ({k})"))
                    .unwrap_or_else(|| "COGMINT Custom Env".into())
            } else {
                "COGMINT Custom Env".into()
            };
            return HarnessAuthInfo {
                status: AuthStatus::Authenticated,
                method: AuthMethod::CogmintProfile,
                detail: Some(detail),
                login_command,
                api_key_env,
                base_url_env,
                supports_oauth: meta.supports_oauth,
                auth_notes,
            };
        }
    }

    // 2. Check OS / shell environment variables
    let mut env_candidates: Vec<&str> = Vec::new();
    if let Some(primary) = meta.api_key_env {
        env_candidates.push(primary);
    }
    env_candidates.extend_from_slice(meta.alt_api_key_envs);

    for var in env_candidates {
        if env_lookup(var)
            .as_deref()
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false)
        {
            return HarnessAuthInfo {
                status: AuthStatus::Authenticated,
                method: AuthMethod::EnvVar,
                detail: Some(format!("ENV: {var}")),
                login_command,
                api_key_env,
                base_url_env,
                supports_oauth: meta.supports_oauth,
                auth_notes,
            };
        }
    }

    // 3. Check local CLI OAuth / credential files (existence & non-empty only)
    if let Some(home) = home_dir {
        if let Some(detail) = local_oauth_credential_detail(harness_id, home) {
            return HarnessAuthInfo {
                status: AuthStatus::Authenticated,
                method: AuthMethod::OauthFile,
                detail: Some(detail),
                login_command,
                api_key_env,
                base_url_env,
                supports_oauth: meta.supports_oauth,
                auth_notes,
            };
        }
    }

    let status = if meta.api_key_env.is_none() && !meta.supports_oauth {
        AuthStatus::Unknown
    } else {
        AuthStatus::Unauthenticated
    };

    HarnessAuthInfo {
        status,
        method: AuthMethod::None,
        detail: None,
        login_command,
        api_key_env,
        base_url_env,
        supports_oauth: meta.supports_oauth,
        auth_notes,
    }
}

pub fn detect_harness_auth(
    harness_id: &str,
    profile: Option<&HarnessAuthProfile>,
) -> HarnessAuthInfo {
    let home = dirs::home_dir();
    detect_harness_auth_with_env(harness_id, home.as_deref(), profile, |k| {
        std::env::var(k).ok()
    })
}

/// Builds the per-PTY environment map to inject when launching a harness with a COGMINT auth profile.
pub fn build_harness_env(
    harness_id: &str,
    profile: &HarnessAuthProfile,
) -> HashMap<String, String> {
    let mut env = HashMap::new();
    if !profile.use_custom_env {
        return env;
    }

    let meta = builtin_auth_meta(harness_id);

    if let (Some(var_name), Some(key)) = (
        meta.api_key_env,
        profile
            .api_key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    ) {
        env.insert(var_name.to_string(), key.to_string());
    }

    if let (Some(var_name), Some(url)) = (
        meta.base_url_env,
        profile
            .base_url
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    ) {
        env.insert(var_name.to_string(), url.to_string());
    }

    for (k, v) in &profile.extra_env {
        let key = k.trim();
        if !key.is_empty() {
            env.insert(key.to_string(), v.clone());
        }
    }

    env
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_mask_secret_hides_middle_characters() {
        assert_eq!(mask_secret("sk-ant-api03-1234567890abcd"), "sk-a••••abcd");
        assert_eq!(mask_secret("short"), "••••••••");
    }

    #[test]
    fn test_detect_auth_prefers_cogmint_profile_then_env_then_oauth_file() {
        let dir = tempdir().unwrap();
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(claude_dir.join(".credentials.json"), r#"{"token":"ok"}"#).unwrap();

        // 1. OAuth file detected when no profile or env var
        let oauth = detect_harness_auth_with_env("claude", Some(dir.path()), None, |_| None);
        assert_eq!(oauth.status, AuthStatus::Authenticated);
        assert_eq!(oauth.method, AuthMethod::OauthFile);

        // 2. Env var takes precedence over OAuth file
        let env_auth = detect_harness_auth_with_env("claude", Some(dir.path()), None, |k| {
            (k == "ANTHROPIC_API_KEY").then(|| "sk-ant-test".into())
        });
        assert_eq!(env_auth.status, AuthStatus::Authenticated);
        assert_eq!(env_auth.method, AuthMethod::EnvVar);
        assert_eq!(env_auth.detail.as_deref(), Some("ENV: ANTHROPIC_API_KEY"));

        // 3. COGMINT profile takes precedence over env var when enabled
        let profile = HarnessAuthProfile {
            harness_id: "claude".into(),
            api_key: Some("sk-ant-override".into()),
            base_url: Some("https://gateway.example.com".into()),
            extra_env: HashMap::new(),
            use_custom_env: true,
        };
        let prof_auth =
            detect_harness_auth_with_env("claude", Some(dir.path()), Some(&profile), |_| None);
        assert_eq!(prof_auth.status, AuthStatus::Authenticated);
        assert_eq!(prof_auth.method, AuthMethod::CogmintProfile);
    }

    #[test]
    fn test_build_harness_env_injects_api_key_base_url_and_extra_env() {
        let mut extra = HashMap::new();
        extra.insert("HTTP_PROXY".into(), "http://127.0.0.1:7890".into());
        let profile = HarnessAuthProfile {
            harness_id: "claude".into(),
            api_key: Some("sk-ant-123".into()),
            base_url: Some("https://proxy.corp.internal".into()),
            extra_env: extra,
            use_custom_env: true,
        };
        let env = build_harness_env("claude", &profile);
        assert_eq!(env.get("ANTHROPIC_API_KEY").map(String::as_str), Some("sk-ant-123"));
        assert_eq!(
            env.get("ANTHROPIC_BASE_URL").map(String::as_str),
            Some("https://proxy.corp.internal")
        );
        assert_eq!(
            env.get("HTTP_PROXY").map(String::as_str),
            Some("http://127.0.0.1:7890")
        );

        // Disabled profile returns empty env
        let disabled = HarnessAuthProfile {
            use_custom_env: false,
            ..profile
        };
        assert!(build_harness_env("claude", &disabled).is_empty());
    }
}
