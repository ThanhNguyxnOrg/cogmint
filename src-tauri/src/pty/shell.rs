use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfile {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args: Vec<String>,
    pub is_wsl: bool,
}

fn command_exists(program: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        Command::new("where.exe")
            .arg(program)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        if program.starts_with('/') {
            return std::path::Path::new(program).exists();
        }
        Command::new("which")
            .arg(program)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

pub fn detect_available_shells() -> Vec<ShellProfile> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if command_exists("pwsh") {
            shells.push(ShellProfile {
                id: "pwsh".into(),
                label: "PowerShell 7 (pwsh)".into(),
                program: "pwsh.exe".into(),
                args: vec!["-NoLogo".into()],
                is_wsl: false,
            });
        }
        if command_exists("powershell") {
            shells.push(ShellProfile {
                id: "powershell".into(),
                label: "Windows PowerShell".into(),
                program: "powershell.exe".into(),
                args: vec!["-NoLogo".into()],
                is_wsl: false,
            });
        }
        let git_bash = r"C:\Program Files\Git\bin\bash.exe";
        if std::path::Path::new(git_bash).exists() {
            shells.push(ShellProfile {
                id: "git-bash".into(),
                label: "Git Bash".into(),
                program: git_bash.into(),
                args: vec!["--login".into(), "-i".into()],
                is_wsl: false,
            });
        }
        shells.push(ShellProfile {
            id: "cmd".into(),
            label: "Command Prompt (cmd)".into(),
            program: "cmd.exe".into(),
            args: vec![],
            is_wsl: false,
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(user_shell) = std::env::var("SHELL") {
            if !user_shell.is_empty() && std::path::Path::new(&user_shell).exists() {
                let name = std::path::Path::new(&user_shell)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("shell")
                    .to_string();
                shells.push(ShellProfile {
                    id: name.clone(),
                    label: format!("Login Shell ({name})"),
                    program: user_shell,
                    args: vec!["-l".into()],
                    is_wsl: false,
                });
            }
        }
        for (id, label, path) in [
            ("zsh", "Zsh", "/bin/zsh"),
            ("bash", "Bash", "/bin/bash"),
            ("sh", "POSIX sh", "/bin/sh"),
        ] {
            if !shells.iter().any(|s| s.program == path) && command_exists(path) {
                shells.push(ShellProfile {
                    id: id.into(),
                    label: label.into(),
                    program: path.into(),
                    args: vec!["-l".into()],
                    is_wsl: false,
                });
            }
        }
    }

    shells
}

pub fn list_wsl_distros() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let Ok(out) = Command::new("wsl.exe")
            .args(["-l", "-q"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        else {
            return Vec::new();
        };
        if !out.status.success() {
            return Vec::new();
        }
        // wsl.exe -l -q outputs UTF-16LE on Windows
        let text = if out.stdout.len() >= 2 && out.stdout[1] == 0 {
            let u16s: Vec<u16> = out
                .stdout
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16_lossy(&u16s)
        } else {
            String::from_utf8_lossy(&out.stdout).to_string()
        };
        text.lines()
            .map(|l| l.trim().trim_start_matches('\u{feff}').to_string())
            .filter(|l| !l.is_empty())
            .collect()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

pub fn build_wsl_command(
    distro: &str,
    cwd: &str,
    command_argv: &[String],
) -> (String, Vec<String>) {
    let mut args = vec![
        "-d".to_string(),
        distro.to_string(),
        "--cd".to_string(),
        cwd.to_string(),
    ];
    if !command_argv.is_empty() {
        args.push("--".to_string());
        args.extend(command_argv.iter().cloned());
    }
    ("wsl.exe".to_string(), args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shells_returns_at_least_one_native_shell() {
        let shells = detect_available_shells();
        assert!(!shells.is_empty());
    }

    #[test]
    fn test_build_wsl_command_uses_distro_and_cd() {
        let (prog, args) = build_wsl_command("Ubuntu", "/home/dev/app", &["claude".into()]);
        assert_eq!(prog, "wsl.exe");
        assert_eq!(
            args,
            vec!["-d", "Ubuntu", "--cd", "/home/dev/app", "--", "claude"]
        );
    }
}
