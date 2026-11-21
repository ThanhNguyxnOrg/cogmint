use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const IDLE_TIMEOUT_MS: i64 = 3_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttentionState {
    Working,
    NeedsAttention,
    Idle,
    Done,
    Failed,
    Hibernated,
}

impl AttentionState {
    pub fn as_str(&self) -> &'static str {
        match self {
            AttentionState::Working => "working",
            AttentionState::NeedsAttention => "needs_attention",
            AttentionState::Idle => "idle",
            AttentionState::Done => "done",
            AttentionState::Failed => "failed",
            AttentionState::Hibernated => "hibernated",
        }
    }
}

/// Strips ANSI CSI (`\x1b[...`), OSC (`\x1b]...(\x07|\x1b\\)`), and standalone ESC sequences.
pub fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            match chars.peek().copied() {
                Some('[') => {
                    chars.next();
                    // CSI: consume until final byte 0x40..=0x7E
                    for c in chars.by_ref() {
                        if ('@'..='~').contains(&c) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    // OSC: consume until BEL (\x07) or ST (\x1b\\)
                    while let Some(c) = chars.next() {
                        if c == '\x07' {
                            break;
                        }
                        if c == '\x1b' && chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
                Some(_) => {
                    chars.next();
                }
                None => break,
            }
        } else if ch != '\x07' && ch != '\r' {
            out.push(ch);
        }
    }

    out
}

fn looks_like_attention_prompt(clean_text: &str, had_bell_or_osc_notify: bool) -> bool {
    if had_bell_or_osc_notify {
        return true;
    }
    let lower = clean_text.to_lowercase();
    for needle in [
        "[y/n]",
        "(y/n)",
        "[y/n/a]",
        "allow ",
        "approve ",
        "do you want to proceed",
        "press enter to continue",
        "waiting for approval",
    ] {
        if lower.contains(needle) {
            return true;
        }
    }
    false
}

pub struct AttentionTracker {
    _harness_id: String,
    state: AttentionState,
    last_output_ms: i64,
    tail_buffer: String,
}

impl AttentionTracker {
    pub fn new(harness_id: impl Into<String>) -> Self {
        Self {
            _harness_id: harness_id.into(),
            state: AttentionState::Idle,
            last_output_ms: 0,
            tail_buffer: String::new(),
        }
    }

    pub fn state(&self) -> AttentionState {
        self.state
    }

    pub fn on_output(
        &mut self,
        raw_chunk: &str,
        now_ms: i64,
    ) -> Option<(AttentionState, Option<String>)> {
        let had_bell = raw_chunk.contains('\x07')
            || raw_chunk.contains("\x1b]9;")
            || raw_chunk.contains("\x1b]777;");
        let clean = strip_ansi(raw_chunk);
        if clean.trim().is_empty() && !had_bell {
            return None;
        }

        self.last_output_ms = now_ms;
        self.tail_buffer.push_str(&clean);
        if self.tail_buffer.len() > 1024 {
            let start = self.tail_buffer.len() - 1024;
            let safe_start = self
                .tail_buffer
                .char_indices()
                .find(|(i, _)| *i >= start)
                .map(|(i, _)| i)
                .unwrap_or(0);
            self.tail_buffer.drain(..safe_start);
        }

        let next_state = if looks_like_attention_prompt(&clean, had_bell) {
            AttentionState::NeedsAttention
        } else {
            AttentionState::Working
        };

        let preview = last_non_empty_line(&self.tail_buffer);
        if next_state != self.state {
            self.state = next_state;
            return Some((next_state, preview));
        }
        None
    }

    pub fn on_tick(&mut self, now_ms: i64) -> Option<(AttentionState, Option<String>)> {
        if self.state == AttentionState::Working
            && self.last_output_ms > 0
            && now_ms.saturating_sub(self.last_output_ms) >= IDLE_TIMEOUT_MS
        {
            let tail_preview = last_non_empty_line(&self.tail_buffer);
            let next = if tail_preview
                .as_deref()
                .map(|s| s.trim_end().ends_with('?'))
                .unwrap_or(false)
            {
                AttentionState::NeedsAttention
            } else {
                AttentionState::Idle
            };
            self.state = next;
            return Some((next, tail_preview));
        }
        None
    }

    pub fn on_exit(&mut self, exit_code: Option<i32>) -> (AttentionState, Option<String>) {
        let next = match exit_code {
            Some(0) | None => AttentionState::Done,
            Some(_) => AttentionState::Failed,
        };
        self.state = next;
        (next, last_non_empty_line(&self.tail_buffer))
    }
}

fn last_non_empty_line(text: &str) -> Option<String> {
    text.lines()
        .rev()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .map(|s| truncate_chars(s, 140))
}

fn truncate_chars(s: &str, max_chars: usize) -> String {
    let mut chars = s.chars();
    let collected: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        let mut trimmed: String = collected.chars().take(max_chars.saturating_sub(1)).collect();
        trimmed.push('…');
        trimmed
    } else {
        collected
    }
}

/// Tails the last 16KB of a harness JSONL session file and extracts the latest non-empty
/// assistant text preview (up to 140 chars), skipping tool-only entries.
pub fn extract_latest_words(_harness_id: &str, session_file: &Path) -> Option<String> {
    let mut file = std::fs::File::open(session_file).ok()?;
    let len = file.metadata().ok()?.len();
    let seek_pos = len.saturating_sub(16 * 1024);
    file.seek(SeekFrom::Start(seek_pos)).ok()?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).ok()?;

    for line in buf.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(val) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let role = val
            .get("role")
            .or_else(|| val.pointer("/message/role"))
            .and_then(|v| v.as_str());
        if role != Some("assistant") {
            continue;
        }
        if let Some(text) = extract_text_from_message(&val) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(truncate_chars(trimmed, 140));
            }
        }
    }
    None
}

fn extract_text_from_message(val: &serde_json::Value) -> Option<String> {
    let content = val
        .get("content")
        .or_else(|| val.pointer("/message/content"))?;
    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }
    if let Some(arr) = content.as_array() {
        for item in arr.iter().rev() {
            if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    if !text.trim().is_empty() {
                        return Some(text.to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_removes_csi_and_osc_sequences() {
        assert_eq!(
            strip_ansi("\x1b[32mAllow tool?\x1b[0m \x1b]0;title\x07(y/n)"),
            "Allow tool? (y/n)"
        );
    }

    #[test]
    fn test_attention_transitions_working_to_needs_attention_on_prompt_and_idle() {
        let mut t = AttentionTracker::new("claude");
        assert_eq!(
            t.on_output("Thinking...\n", 1_000).unwrap().0,
            AttentionState::Working
        );
        assert_eq!(
            t.on_output("Allow Bash tool? [y/N]\x07", 2_000).unwrap().0,
            AttentionState::NeedsAttention
        );
    }

    #[test]
    fn test_attention_exit_codes_map_to_done_or_failed() {
        let mut t = AttentionTracker::new("codex");
        assert_eq!(t.on_exit(Some(0)).0, AttentionState::Done);
        assert_eq!(t.on_exit(Some(1)).0, AttentionState::Failed);
    }

    #[test]
    fn test_extract_latest_words_truncates_and_skips_tool_only_entries() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("sess.jsonl");
        let long_text = "A".repeat(200);
        let content = format!(
            "{{\"role\":\"user\",\"content\":\"fix it\"}}\n\
             {{\"role\":\"assistant\",\"content\":[{{\"type\":\"text\",\"text\":\"{long_text}\"}}]}}\n\
             {{\"role\":\"assistant\",\"content\":[{{\"type\":\"tool_use\",\"name\":\"Bash\"}}]}}\n"
        );
        std::fs::write(&file, content).unwrap();
        let words = extract_latest_words("claude", &file).unwrap();
        assert!(words.chars().count() <= 140);
        assert!(words.ends_with('…'));
    }
}
