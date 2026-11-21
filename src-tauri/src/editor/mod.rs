use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "kind", content = "template")]
pub enum EditorPreset {
    VsCode,
    Cursor,
    Zed,
    Custom(String),
}

fn format_path_location(path: &Path, line: Option<u32>, col: Option<u32>) -> String {
    let base = path.to_string_lossy();
    match (line, col) {
        (Some(l), Some(c)) => format!("{base}:{l}:{c}"),
        (Some(l), None) => format!("{base}:{l}"),
        _ => base.to_string(),
    }
}

/// Builds `(program, args)` directly without shell string interpolation (immune to shell injection).
pub fn build_editor_argv(
    preset: &EditorPreset,
    path: &Path,
    line: Option<u32>,
    col: Option<u32>,
) -> AppResult<(String, Vec<String>)> {
    let loc = format_path_location(path, line, col);
    match preset {
        EditorPreset::VsCode => Ok(("code".into(), vec!["--goto".into(), loc])),
        EditorPreset::Cursor => Ok(("cursor".into(), vec!["--goto".into(), loc])),
        EditorPreset::Zed => Ok(("zed".into(), vec![loc])),
        EditorPreset::Custom(template) => {
            let trimmed = template.trim();
            if trimmed.is_empty() {
                return Err(AppError::InvalidInput(
                    "Custom editor command template cannot be empty".into(),
                ));
            }
            let raw_tokens = split_quoted_tokens(trimmed);
            if raw_tokens.is_empty() {
                return Err(AppError::InvalidInput(
                    "Custom editor command template cannot be empty".into(),
                ));
            }
            let tokens: Vec<String> = raw_tokens
                .into_iter()
                .map(|tok| {
                    tok.replace("{path}", &path.to_string_lossy())
                        .replace("{line}", &line.unwrap_or(1).to_string())
                        .replace("{col}", &col.unwrap_or(1).to_string())
                })
                .collect();
            let prog = tokens[0].clone();
            let args = tokens[1..].to_vec();
            Ok((prog, args))
        }
    }
}

fn split_quoted_tokens(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    for ch in input.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            c if c.is_whitespace() && !in_quotes => {
                if !cur.is_empty() {
                    tokens.push(std::mem::take(&mut cur));
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.is_empty() {
        tokens.push(cur);
    }
    tokens
}

fn resolve_windows_shim(program: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        if !program.ends_with(".exe") && !program.ends_with(".cmd") && !program.contains('\\') {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            if let Ok(out) = Command::new("where.exe")
                .arg(program)
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    if let Some(first) = stdout.lines().map(str::trim).find(|l| {
                        let lower = l.to_ascii_lowercase();
                        lower.ends_with(".cmd") || lower.ends_with(".exe")
                    }) {
                        return first.to_string();
                    }
                }
            }
        }
    }
    program.to_string()
}

pub fn open_in_editor(
    preset: &EditorPreset,
    path: &Path,
    line: Option<u32>,
    col: Option<u32>,
) -> AppResult<()> {
    let (prog, args) = build_editor_argv(preset, path, line, col)?;
    let resolved = resolve_windows_shim(&prog);
    let mut cmd = Command::new(&resolved);
    cmd.args(&args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.spawn()
        .map_err(|e| AppError::External(format!("Failed to launch editor '{resolved}': {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_editor_launcher_no_shell_injection() {
        let (prog, args) = build_editor_argv(
            &EditorPreset::VsCode,
            Path::new("C:\\My Repo\\a;rm -rf.ts"),
            Some(42),
            Some(5),
        )
        .unwrap();
        assert_eq!(prog, "code");
        assert_eq!(args, vec!["--goto", "C:\\My Repo\\a;rm -rf.ts:42:5"]);
    }

    #[test]
    fn test_custom_editor_template_substitutes_placeholders() {
        let (prog, args) = build_editor_argv(
            &EditorPreset::Custom("nvim +{line} {path}".into()),
            Path::new("/src/lib.rs"),
            Some(88),
            None,
        )
        .unwrap();
        assert_eq!(prog, "nvim");
        assert_eq!(args, vec!["+88", "/src/lib.rs"]);
    }
}
