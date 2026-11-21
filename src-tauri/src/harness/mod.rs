pub mod attention;
pub mod detect;
pub mod resume;

use crate::db::{CustomHarnessRecord, Database};
use crate::error::AppResult;
use crate::harness::detect::detect_command_path;
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
    pub installed: bool,
    pub resolved_path: Option<String>,
}

fn builtin_entry(
    id: &str,
    name: &str,
    mono: &str,
    command: &str,
    default_args: Vec<String>,
    resume_strategy: ResumeStrategy,
    accent_color: &str,
) -> HarnessSpec {
    HarnessSpec {
        id: id.into(),
        name: name.into(),
        mono: mono.into(),
        command: command.into(),
        default_args,
        resume_strategy,
        accent_color: accent_color.into(),
        is_builtin: true,
        enabled: true,
        installed: false,
        resolved_path: None,
    }
}

pub fn builtin_harnesses() -> Vec<HarnessSpec> {
    vec![
        builtin_entry("claude", "Claude Code", "CC", "claude", vec![], ResumeStrategy::ExactFlag, "#D97757"),
        builtin_entry("codex", "Codex CLI", "CX", "codex", vec!["-c".into(), "tui.animations=false".into()], ResumeStrategy::ExactFlag, "#10A37F"),
        builtin_entry("opencode", "OpenCode", "OC", "opencode", vec![], ResumeStrategy::ExactFlag, "#2F6FFF"),
        builtin_entry("gemini", "Gemini CLI", "GM", "gemini", vec![], ResumeStrategy::LatestFlag, "#4285F4"),
        builtin_entry("copilot", "Copilot CLI", "CP", "copilot", vec![], ResumeStrategy::BareRelaunch, "#E2E8F0"),
        builtin_entry("antigravity", "Antigravity", "AG", "agy", vec![], ResumeStrategy::BareRelaunch, "#05DCA3"),
        builtin_entry("amp", "Amp", "AM", "amp", vec![], ResumeStrategy::BareRelaunch, "#F97316"),
        builtin_entry("kimi", "Kimi Code", "KM", "kimi", vec![], ResumeStrategy::BareRelaunch, "#38BDF8"),
        builtin_entry("kiro", "Kiro CLI", "KR", "kiro-cli", vec![], ResumeStrategy::BareRelaunch, "#A855F7"),
        builtin_entry("grok", "Grok Build", "GK", "grok", vec![], ResumeStrategy::BareRelaunch, "#F8FAFC"),
        builtin_entry("vibe", "Mistral Vibe", "MV", "vibe", vec![], ResumeStrategy::BareRelaunch, "#FB923C"),
        builtin_entry("droid", "Droid", "DR", "droid", vec![], ResumeStrategy::BareRelaunch, "#22D3EE"),
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
                installed: false,
                resolved_path: None,
            });
        }
    }

    // Auto-detect which harnesses are actually installed on this machine
    for spec in &mut specs {
        let resolved = detect_command_path(&spec.command);
        spec.installed = resolved.is_some();
        spec.resolved_path = resolved;
    }

    // Sort installed harnesses first, preserving catalog order within each group
    specs.sort_by_key(|s| !s.installed);

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
