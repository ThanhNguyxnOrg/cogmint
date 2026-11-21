use std::path::{Path, PathBuf};

/// Resolves whether a CLI command is installed on the local machine across Windows, macOS, and Linux.
/// Checks `PATH` (via `where.exe` on Windows or PATH scan on Unix) plus common user binary directories.
pub fn detect_command_path(command: &str) -> Option<String> {
    let cmd = command.trim();
    if cmd.is_empty() {
        return None;
    }

    // Direct path check if user provided an explicit path
    let direct = Path::new(cmd);
    if direct.is_absolute() && direct.is_file() {
        return Some(direct.to_string_lossy().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(found) = detect_windows(cmd) {
            return Some(found);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(found) = detect_unix(cmd) {
            return Some(found);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn detect_windows(cmd: &str) -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    if let Ok(out) = std::process::Command::new("where.exe")
        .arg(cmd)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<&str> = stdout
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .collect();
            // Prefer .exe > .cmd > .bat > first match
            for ext in [".exe", ".cmd", ".bat"] {
                if let Some(m) = lines.iter().find(|l| l.to_ascii_lowercase().ends_with(ext)) {
                    return Some((*m).to_string());
                }
            }
            if let Some(first) = lines.first() {
                return Some((*first).to_string());
            }
        }
    }

    // Fallback scan of common Windows CLI install locations (npm, bun, cargo, local bin)
    let mut dirs_to_check: Vec<PathBuf> = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs_to_check.push(PathBuf::from(appdata).join("npm"));
    }
    if let Some(home) = dirs::home_dir() {
        dirs_to_check.push(home.join(".local").join("bin"));
        dirs_to_check.push(home.join(".bun").join("bin"));
        dirs_to_check.push(home.join(".cargo").join("bin"));
    }

    let exts = ["exe", "cmd", "bat"];
    for dir in dirs_to_check {
        for ext in exts {
            let candidate = dir.join(format!("{cmd}.{ext}"));
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().to_string());
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
fn detect_unix(cmd: &str) -> Option<String> {
    use std::os::unix::fs::PermissionsExt;

    let mut search_dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();

    if let Some(home) = dirs::home_dir() {
        search_dirs.push(home.join(".local").join("bin"));
        search_dirs.push(home.join(".bun").join("bin"));
        search_dirs.push(home.join(".cargo").join("bin"));
    }
    search_dirs.push(PathBuf::from("/opt/homebrew/bin"));
    search_dirs.push(PathBuf::from("/usr/local/bin"));

    for dir in search_dirs {
        let candidate = dir.join(cmd);
        if let Ok(meta) = std::fs::metadata(&candidate) {
            if meta.is_file() && (meta.permissions().mode() & 0o111 != 0) {
                return Some(candidate.to_string_lossy().to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_command_finds_existing_system_binary() {
        let found = detect_command_path("git");
        assert!(found.is_some(), "expected git to be detected on PATH");
    }

    #[test]
    fn test_detect_command_returns_none_for_missing_binary() {
        let found = detect_command_path("definitely-not-installed-cli-xyz-9999");
        assert!(found.is_none());
    }
}
