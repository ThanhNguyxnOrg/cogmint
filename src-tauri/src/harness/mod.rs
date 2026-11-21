pub mod attention;
pub mod resume;

use crate::db::{CustomHarnessRecord, Database};
use crate::error::AppResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResumeStrategy {
    ExactFlag,
    LatestFlag,
    BareRelaunch,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessSpec {
    pub id: String,
    pub name: String,
    pub mono: String,
    pub command: String,
    pub default_args: Vec<String>,
    pub resume_strategy: ResumeStrategy,
    pub accent_color: String,
    pub is_builtin: bool,
    pub enabled: bool,
}

pub fn builtin_harnesses() -> Vec<HarnessSpec> {
    vec![
        HarnessSpec {
            id: "claude".into(),
            name: "Claude Code".into(),
            mono: "CC".into(),
            command: "claude".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::ExactFlag,
            accent_color: "#D97757".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "codex".into(),
            name: "Codex CLI".into(),
            mono: "CX".into(),
            command: "codex".into(),
            default_args: vec!["-c".into(), "tui.animations=false".into()],
            resume_strategy: ResumeStrategy::ExactFlag,
            accent_color: "#10A37F".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "opencode".into(),
            name: "OpenCode".into(),
            mono: "OC".into(),
            command: "opencode".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::ExactFlag,
            accent_color: "#2F6FFF".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "gemini".into(),
            name: "Gemini CLI".into(),
            mono: "GM".into(),
            command: "gemini".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::LatestFlag,
            accent_color: "#4285F4".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "copilot".into(),
            name: "Copilot CLI".into(),
            mono: "CP".into(),
            command: "copilot".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#6E7681".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "antigravity".into(),
            name: "Antigravity".into(),
            mono: "AG".into(),
            command: "agy".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#05DCA3".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "amp".into(),
            name: "Amp".into(),
            mono: "AM".into(),
            command: "amp".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#F97316".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "kimi".into(),
            name: "Kimi Code".into(),
            mono: "KM".into(),
            command: "kimi".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#38BDF8".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "kiro".into(),
            name: "Kiro CLI".into(),
            mono: "KR".into(),
            command: "kiro-cli".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#A855F7".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "grok".into(),
            name: "Grok Build".into(),
            mono: "GK".into(),
            command: "grok".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#E2E8F0".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "vibe".into(),
            name: "Mistral Vibe".into(),
            mono: "MV".into(),
            command: "vibe".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#FB923C".into(),
            is_builtin: true,
            enabled: true,
        },
        HarnessSpec {
            id: "droid".into(),
            name: "Droid".into(),
            mono: "DR".into(),
            command: "droid".into(),
            default_args: vec![],
            resume_strategy: ResumeStrategy::BareRelaunch,
            accent_color: "#22D3EE".into(),
            is_builtin: true,
            enabled: true,
        },
    ]
}

pub fn list_all_harnesses(db: &Database) -> AppResult<Vec<HarnessSpec>> {
    let mut specs = builtin_harnesses();
    let custom = db.list_custom_harnesses()?;
    for c in custom {
        if let Some(existing) = specs.iter_mut().find(|s| s.id == c.id) {
            existing.name = c.name;
            existing.command = c.command;
            existing.default_args = c.default_args;
            existing.accent_color = c.accent_color;
            existing.enabled = c.enabled;
        } else {
            let mono: String = c
                .name
                .chars()
                .filter(|ch| ch.is_ascii_alphanumeric())
                .take(2)
                .collect::<String>()
                .to_uppercase();
            specs.push(HarnessSpec {
                id: c.id,
                name: c.name,
                mono: if mono.is_empty() { "CL".into() } else { mono },
                command: c.command,
                default_args: c.default_args,
                resume_strategy: ResumeStrategy::BareRelaunch,
                accent_color: c.accent_color,
                is_builtin: false,
                enabled: c.enabled,
            });
        }
    }
    Ok(specs)
}

pub fn build_launch_argv(
    spec: &HarnessSpec,
    resume_session_id: Option<&str>,
    new_session_id: Option<&str>,
    extra_args: &[String],
) -> (String, Vec<String>) {
    let mut args = spec.default_args.clone();

    match spec.id.as_str() {
        "claude" => {
            if let Some(sid) = resume_session_id.filter(|s| !s.trim().is_empty()) {
                args.push("--resume".into());
                args.push(sid.to_string());
            } else if let Some(nid) = new_session_id.filter(|s| !s.trim().is_empty()) {
                args.push("--session-id".into());
                args.push(nid.to_string());
            }
        }
        "codex" => {
            if let Some(sid) = resume_session_id.filter(|s| !s.trim().is_empty()) {
                args.push("resume".into());
                args.push(sid.to_string());
            }
        }
        "opencode" => {
            if let Some(sid) = resume_session_id.filter(|s| !s.trim().is_empty()) {
                args.push("-s".into());
                args.push(sid.to_string());
            }
        }
        "gemini" if resume_session_id.is_some() => {
            args.push("--resume".into());
            args.push("latest".into());
        }
        _ => {}
    }

    args.extend(extra_args.iter().cloned());
    (spec.command.clone(), args)
}

pub fn upsert_custom_harness_record(db: &Database, rec: &CustomHarnessRecord) -> AppResult<()> {
    db.upsert_custom_harness(rec)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_catalog_contains_all_12_harnesses() {
        let ids: Vec<_> = builtin_harnesses().into_iter().map(|h| h.id).collect();
        assert_eq!(ids.len(), 12);
        for expected in [
            "claude",
            "codex",
            "opencode",
            "gemini",
            "copilot",
            "antigravity",
            "amp",
            "kimi",
            "kiro",
            "grok",
            "vibe",
            "droid",
        ] {
            assert!(ids.contains(&expected.to_string()), "missing harness {expected}");
        }
    }

    #[test]
    fn test_claude_launch_argv_uses_resume_or_preallocated_session_id() {
        let claude = builtin_harnesses()
            .into_iter()
            .find(|h| h.id == "claude")
            .unwrap();
        let (_, args_resume) = build_launch_argv(&claude, Some("sess-123"), None, &[]);
        assert!(args_resume.windows(2).any(|w| w == ["--resume", "sess-123"]));
        let (_, args_new) = build_launch_argv(&claude, None, Some("uuid-456"), &[]);
        assert!(args_new.windows(2).any(|w| w == ["--session-id", "uuid-456"]));
    }
}
