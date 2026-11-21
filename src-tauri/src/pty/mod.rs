pub mod shell;

use crate::error::{AppError, AppResult};
use crate::harness::attention::AttentionTracker;
use crate::pty::shell::{build_wsl_command, detect_available_shells};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "event",
    content = "data"
)]
pub enum PtyStreamEvent {
    Output {
        data: String,
    },
    Exit {
        exit_code: Option<i32>,
    },
    Attention {
        state: String,
        latest_words: Option<String>,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnPtyRequest {
    pub pane_id: String,
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
    #[serde(default)]
    pub harness_id: Option<String>,
    pub program: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub shell_profile: Option<String>,
}

/// Decodes incoming PTY bytes into valid UTF-8, buffering any incomplete trailing
/// multi-byte UTF-8 sequence in `carry` until the next chunk arrives.
pub fn decode_utf8_chunk(carry: &mut Vec<u8>, incoming: &[u8]) -> String {
    if incoming.is_empty() && carry.is_empty() {
        return String::new();
    }

    let mut combined = Vec::with_capacity(carry.len() + incoming.len());
    combined.extend_from_slice(carry);
    combined.extend_from_slice(incoming);
    carry.clear();

    let mut out = String::new();
    let mut idx = 0;

    while idx < combined.len() {
        match std::str::from_utf8(&combined[idx..]) {
            Ok(valid) => {
                out.push_str(valid);
                break;
            }
            Err(err) => {
                let valid_len = err.valid_up_to();
                if valid_len > 0 {
                    out.push_str(
                        std::str::from_utf8(&combined[idx..idx + valid_len]).unwrap_or_default(),
                    );
                }
                idx += valid_len;
                match err.error_len() {
                    Some(invalid_len) => {
                        out.push('\u{FFFD}');
                        idx += invalid_len;
                    }
                    None => {
                        // Incomplete UTF-8 sequence at end of buffer — save for next chunk
                        carry.extend_from_slice(&combined[idx..]);
                        break;
                    }
                }
            }
        }
    }

    out
}

struct PtySession {
    cwd: std::path::PathBuf,
    child_pid: Option<u32>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

fn terminate_process_tree(child: &mut Box<dyn Child + Send + Sync>, pid: Option<u32>) {
    #[cfg(target_os = "windows")]
    if let Some(id) = pid {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = std::process::Command::new("taskkill")
            .args(["/T", "/F", "/PID", &id.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    let _ = pid;
    let _ = child.kill();
}

#[derive(Default)]
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn spawn<F>(&self, req: SpawnPtyRequest, on_event: F) -> AppResult<()>
    where
        F: Fn(PtyStreamEvent) + Send + Sync + 'static,
    {
        // Terminate existing session with same pane_id if present
        let _ = self.kill(&req.pane_id);

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: req.rows.max(4),
                cols: req.cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Pty(format!("Failed to open PTY: {e}")))?;

        let (program, args) = resolve_spawn_command(&req)?;
        let mut cmd = CommandBuilder::new(&program);
        for arg in &args {
            cmd.arg(arg);
        }
        if !req.cwd.is_empty() && std::path::Path::new(&req.cwd).exists() {
            cmd.cwd(&req.cwd);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        for (k, v) in &req.env {
            cmd.env(k, v);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::Pty(format!("Failed to spawn '{program}': {e}")))?;
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Pty(format!("Failed to clone PTY reader: {e}")))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::Pty(format!("Failed to take PTY writer: {e}")))?;

        let pane_id = req.pane_id.clone();
        let child_pid = child.process_id();
        let cwd_buf = std::path::PathBuf::from(&req.cwd);
        {
            let mut map = self
                .sessions
                .lock()
                .map_err(|e| AppError::Pty(format!("PTY mutex poisoned: {e}")))?;
            map.insert(
                pane_id.clone(),
                PtySession {
                    cwd: cwd_buf,
                    child_pid,
                    master: pair.master,
                    writer,
                    child,
                },
            );
        }

        let sessions_ref = Arc::clone(&self.sessions);
        let on_event = Arc::new(on_event);
        let harness_label = req.program.clone().unwrap_or_else(|| "shell".into());
        std::thread::Builder::new()
            .name(format!("pty-reader-{}", pane_id))
            .spawn(move || {
                let mut buf = [0u8; 4096];
                let mut carry = Vec::new();
                let mut tracker = AttentionTracker::new(harness_label);
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = decode_utf8_chunk(&mut carry, &buf[..n]);
                            if !text.is_empty() {
                                let now_ms = chrono::Utc::now().timestamp_millis();
                                if let Some((state, latest_words)) =
                                    tracker.on_output(&text, now_ms)
                                {
                                    on_event(PtyStreamEvent::Attention {
                                        state: state.as_str().to_string(),
                                        latest_words,
                                    });
                                }
                                on_event(PtyStreamEvent::Output { data: text });
                            }
                        }
                        Err(_) => break,
                    }
                }
                if !carry.is_empty() {
                    let trailing = String::from_utf8_lossy(&carry).to_string();
                    on_event(PtyStreamEvent::Output { data: trailing });
                }

                let exit_code = sessions_ref
                    .lock()
                    .ok()
                    .and_then(|mut map| map.remove(&pane_id))
                    .and_then(|mut sess| sess.child.wait().ok())
                    .map(|status| status.exit_code() as i32);

                let (final_state, latest_words) = tracker.on_exit(exit_code);
                on_event(PtyStreamEvent::Attention {
                    state: final_state.as_str().to_string(),
                    latest_words,
                });
                on_event(PtyStreamEvent::Exit { exit_code });
            })
            .map_err(|e| AppError::Pty(format!("Failed to spawn PTY reader thread: {e}")))?;

        Ok(())
    }

    pub fn write(&self, pane_id: &str, data: &[u8]) -> AppResult<()> {
        let mut map = self
            .sessions
            .lock()
            .map_err(|e| AppError::Pty(format!("PTY mutex poisoned: {e}")))?;
        let sess = map
            .get_mut(pane_id)
            .ok_or_else(|| AppError::NotFound(format!("PTY session '{pane_id}' not found")))?;
        sess.writer
            .write_all(data)
            .map_err(|e| AppError::Pty(format!("PTY write failed: {e}")))?;
        sess.writer
            .flush()
            .map_err(|e| AppError::Pty(format!("PTY flush failed: {e}")))?;
        Ok(())
    }

    pub fn resize(&self, pane_id: &str, cols: u16, rows: u16) -> AppResult<()> {
        let map = self
            .sessions
            .lock()
            .map_err(|e| AppError::Pty(format!("PTY mutex poisoned: {e}")))?;
        let sess = map
            .get(pane_id)
            .ok_or_else(|| AppError::NotFound(format!("PTY session '{pane_id}' not found")))?;
        sess.master
            .resize(PtySize {
                rows: rows.max(4),
                cols: cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Pty(format!("PTY resize failed: {e}")))?;
        Ok(())
    }

    pub fn kill(&self, pane_id: &str) -> AppResult<()> {
        let mut map = self
            .sessions
            .lock()
            .map_err(|e| AppError::Pty(format!("PTY mutex poisoned: {e}")))?;
        if let Some(mut sess) = map.remove(pane_id) {
            let pid = sess.child_pid;
            terminate_process_tree(&mut sess.child, pid);
            drop(sess);
        }
        Ok(())
    }

    pub fn kill_in_cwd(&self, dir: &std::path::Path) {
        if let Ok(mut map) = self.sessions.lock() {
            let target_ids: Vec<String> = map
                .iter()
                .filter(|(_, s)| s.cwd == dir || s.cwd.starts_with(dir))
                .map(|(id, _)| id.clone())
                .collect();
            for id in target_ids {
                if let Some(mut sess) = map.remove(&id) {
                    let pid = sess.child_pid;
                    terminate_process_tree(&mut sess.child, pid);
                }
            }
        }
    }

    pub fn kill_all(&self) {
        if let Ok(mut map) = self.sessions.lock() {
            for (_, mut sess) in map.drain() {
                let pid = sess.child_pid;
                terminate_process_tree(&mut sess.child, pid);
            }
        }
    }
}

fn resolve_spawn_command(req: &SpawnPtyRequest) -> AppResult<(String, Vec<String>)> {
    if let Some(profile) = &req.shell_profile {
        if let Some(distro) = profile.strip_prefix("wsl:") {
            let mut argv = Vec::new();
            if let Some(prog) = &req.program {
                argv.push(prog.clone());
                argv.extend(req.args.iter().cloned());
            }
            return Ok(build_wsl_command(distro, &req.cwd, &argv));
        }
    }

    if let Some(prog) = &req.program {
        if !prog.trim().is_empty() {
            #[cfg(target_os = "windows")]
            {
                let resolved = crate::harness::detect::detect_command_path(prog)
                    .unwrap_or_else(|| prog.clone());
                let lower = resolved.to_ascii_lowercase();
                if lower.ends_with(".cmd") || lower.ends_with(".bat") {
                    let mut cmd_args = vec!["/C".to_string(), resolved];
                    cmd_args.extend(req.args.iter().cloned());
                    return Ok(("cmd.exe".to_string(), cmd_args));
                }
                return Ok((resolved, req.args.clone()));
            }
            #[cfg(not(target_os = "windows"))]
            {
                let resolved = crate::harness::detect::detect_command_path(prog)
                    .unwrap_or_else(|| prog.clone());
                return Ok((resolved, req.args.clone()));
            }
        }
    }

    let shells = detect_available_shells();
    if let Some(profile) = &req.shell_profile {
        if let Some(found) = shells.iter().find(|s| &s.id == profile) {
            return Ok((found.program.clone(), found.args.clone()));
        }
    }
    let default = shells
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Pty("No usable shell found on this system".into()))?;
    Ok((default.program, default.args))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn test_pty_utf8_boundary_buffering() {
        let full = "Tiếng Việt ──▶ ok".as_bytes();
        let split = 4; // mid-codepoint of 'ế'
        let mut carry = Vec::new();
        let part1 = decode_utf8_chunk(&mut carry, &full[..split]);
        let part2 = decode_utf8_chunk(&mut carry, &full[split..]);
        assert_eq!(format!("{part1}{part2}"), "Tiếng Việt ──▶ ok");
        assert!(carry.is_empty());
    }

    #[test]
    fn test_pty_kill_cleans_up_session_and_closes_channel() {
        let mgr = PtyManager::new();
        let (tx, rx) = mpsc::channel();

        let (prog, args) = if cfg!(target_os = "windows") {
            ("cmd.exe".to_string(), vec!["/K".into(), "echo".into(), "hello_pty".into()])
        } else {
            ("/bin/sh".to_string(), vec!["-c".into(), "echo hello_pty; sleep 30".into()])
        };

        mgr.spawn(
            SpawnPtyRequest {
                pane_id: "pane-test".into(),
                cwd: std::env::temp_dir().to_string_lossy().to_string(),
                cols: 80,
                rows: 24,
                harness_id: None,
                program: Some(prog),
                args,
                env: HashMap::new(),
                shell_profile: None,
            },
            move |evt| {
                let _ = tx.send(evt);
            },
        )
        .unwrap();

        let mut collected = String::new();
        for _ in 0..30 {
            if let Ok(PtyStreamEvent::Output { data }) = rx.recv_timeout(Duration::from_millis(250)) {
                if data.contains("\x1b[6n") {
                    // ConPTY waits for terminal DSR cursor-position response in headless tests
                    let _ = mgr.write("pane-test", b"\x1b[1;1R");
                }
                collected.push_str(&data);
                if collected.contains("hello_pty") {
                    break;
                }
            }
        }
        assert!(
            collected.contains("hello_pty"),
            "expected PTY output containing hello_pty, got: {collected:?}"
        );

        mgr.kill("pane-test").unwrap();
        let err = mgr.write("pane-test", b"hi\n").unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}
