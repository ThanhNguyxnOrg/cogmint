# COGMINT v2 — Multi-Harness Agent Workstation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build COGMINT v2, a native 3-OS (Windows, macOS, Linux) local-first Multi-Harness Agent Workstation in Tauri v2 (Rust) + React 19 (TypeScript) supporting parallel CLI coding agents in isolated Git worktrees, an Attention Rail, read-only Git diff/commit surface, and real local token/cost accounting.

**Architecture:** Clean-slate rewrite after tagging legacy Nuxt v1 as `archive/nuxt-v1`. A Tokio-based Rust core (`src-tauri/src/`) owns real 3-OS PTYs (`portable-pty`) streaming over Tauri v2 `ipc::Channel`, a 12-harness catalog + attention/resume engine, Git worktree/diff/merge-dry-run ops, debounced `notify` FS watching, incremental local log parsers + pricing catalog, and WAL SQLite (`rusqlite`) session journaling. A lightweight Vite + React 19 + Tailwind v4 + Zustand frontend (`src/`) renders the Attention Rail, worktree-scoped split-pane WebGL `xterm.js` stage, read-only Diff drawer, and real Usage dashboard.

**Tech Stack:** Tauri v2 (`tauri 2`, `tauri-plugin-dialog`, `tauri-plugin-notification`, `tauri-plugin-opener`), Rust 1.96 (`tokio`, `portable-pty`, `rusqlite`, `notify`, `serde`, `thiserror`, `reqwest`), Vite 6, React 19, TypeScript 5.8+, Tailwind CSS v4, Zustand, `@xterm/xterm` (+ WebGL/Fit/Search/WebLinks addons), Vitest, GitHub Actions 3-OS Matrix.

**Spec:** `docs/superpowers/specs/2026-11-21-cogmint-v2-multi-harness-design.md`

## Global Constraints

- Target platforms: Windows (x64/arm64), macOS (arm64/x64), Linux (x64/arm64) — first-class 3-OS support in all Rust and TS code.
- Local-first & zero telemetry: no Sentry, Supabase, cloud accounts, or analytics beacons; never read CLI OAuth tokens or call private provider quota endpoints.
- Never bundle Electron or `node-pty`; always use Rust `portable-pty` (ConPTY on Windows, `openpty` on macOS/Linux) and Tauri v2 `ipc::Channel` for PTY streaming.
- Never silently mutate user harness config files (e.g., `~/.claude/settings.json`).
- Never silently delete or overwrite partial/dirty Git worktrees on failure.
- Zero mock/fake usage or analytics data; empty state must explain how to run a session.
- Idle memory target `<80MB`; startup restore must open panes in `hibernated` state (lazy spawn on focus/Enter).
- Preserve Nuxt v1 history via git tag `archive/nuxt-v1` before replacing root workspace files.

## Review Focus

1. **Split multi-byte UTF-8 across PTY read chunks** (e.g., Vietnamese/box-drawing characters split across 4KB reads) — PTY reader must buffer incomplete trailing UTF-8 bytes across reads so terminal output never garbles or panics (`Task 3`).
2. **Windows paths with spaces, drive letters, backslashes, and traversal attempts** in `.worktreeinclude`, file links, and external editor launch — `.worktreeinclude` must reject `..`/absolute paths, `linkMatcher` must parse `C:\My Repo\a.ts:12:4`, and `editor` launcher must pass args directly without shell interpolation (`Task 6`, `Task 8`).
3. **Malformed/truncated live-written JSONL lines and duplicate streaming chunks in harness logs** — incremental parsers must tolerate incomplete final lines without advancing offset past partial lines and deduplicate repeated request/message IDs so costs are never double-counted (`Task 9`).
4. **Crash-loop on boot or externally deleted worktree directory** — two unclean boots within 10s must trigger `safe_mode: true` skipping auto-restore, and missing worktree paths must render an unavailable recovery banner without crashing the UI (`Task 2`, `Task 10`).
5. **Orphaned child CLI processes and active `notify` watcher handles locking Windows worktree directories** — closing a pane must terminate its process tree cleanly, and removing a worktree must unwatch its path first so Windows never fails with `EBUSY`/sharing violation (`Task 3`, `Task 7`).

---

## File Structure Map

### Rust Core (`src-tauri/`)
- `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/capabilities/default.json` — Tauri v2 manifest, capabilities (`core:default`, `dialog`, `notification`, `opener`), bundled `resources/pricing.json`.
- `src-tauri/src/error.rs` — Unified `AppError` enum serializable over Tauri IPC.
- `src-tauri/src/db/{mod.rs, journal.rs, usage_cache.rs}` — SQLite WAL connection, schema migrations, crash-loop guard, workspace/pane/layout journaling, incremental usage cache.
- `src-tauri/src/pty/{shell.rs, mod.rs}` — 3-OS login shell detection (+ optional Windows WSL2 profile), `portable-pty` session lifecycle, UTF-8-safe chunked `ipc::Channel<PtyStreamEvent>` streaming.
- `src-tauri/src/harness/{mod.rs, resume.rs, attention.rs}` — 12 built-in harnesses + custom harnesses, exact/best-effort resume argv resolver, ANSI stripper + attention state machine + passive log tailer.
- `src-tauri/src/git/{mod.rs, worktree.rs, merge_preview.rs}` — Repo detection, porcelain v2 status, unified diff, stage/unstage/commit, safe worktree CRUD + `.worktreeinclude`, read-only ahead/behind + `git merge-tree --write-tree`.
- `src-tauri/src/watcher/mod.rs` — Debounced `notify` watcher per active workspace with explicit unwatch/drop.
- `src-tauri/src/editor/mod.rs` — Safe external editor launcher (VS Code, Cursor, Zed, custom command template).
- `src-tauri/src/usage/{pricing.rs, mod.rs, parsers/{mod.rs, claude.rs, codex.rs, opencode.rs}}` — Bundled + refreshable pricing catalog, incremental log parsers, real cost/token/budget aggregation.
- `src-tauri/src/commands/{mod.rs, pty_cmds.rs, workspace_cmds.rs, git_cmds.rs, harness_cmds.rs, usage_cmds.rs, editor_cmds.rs}` — Thin Tauri IPC command layer.

### Frontend (`src/`)
- `src/types/{ipc.ts, workspace.ts, usage.ts}` — Exact TypeScript mirrors of Rust DTOs and Channel events.
- `src/lib/{tauri.ts, splitTree.ts, linkMatcher.ts, keybindings.ts}` — Typed IPC bridge, pure split-pane tree engine, cross-platform file-link parser, 3-OS shortcut resolver.
- `src/stores/{useWorkspaceStore.ts, useSettingsStore.ts}` — Zustand stores for projects, worktree-scoped split trees, hibernated/live panes, attention queue, and user settings.
- `src/components/layout/{AppShell.tsx, StatusBar.tsx, CommandPalette.tsx}` — 3-column shell, live spend/branch/attention status bar, `Cmd/Ctrl+K` palette.
- `src/components/rail/{AttentionRail.tsx, WorktreeCard.tsx}` — Project → Worktree → Pane rail with unread filter and attention indicators.
- `src/components/stage/{SplitStage.tsx, PaneTabBar.tsx, TerminalPane.tsx, LaunchHarnessModal.tsx}` — Recursive split layout, pinnable/reorderable tabs, WebGL `xterm.js` with hibernated overlay, harness launcher.
- `src/components/git/{ChangesDrawer.tsx, UnifiedDiffView.tsx, CreateWorktreeModal.tsx}` — Read-only Files/Changes drawer, diff viewer, quick commit, worktree creation & safe recovery UI.
- `src/components/usage/{UsageDashboard.tsx, PricingSettingsModal.tsx}` — Real spend/token charts, model pricing refresh/overrides, budget pace bar.
- `src/components/settings/SettingsModal.tsx` — Shell, external editor, custom harnesses CRUD, optional Windows WSL2 profiles.

---

### Task 1: Archive Nuxt v1 & Scaffold Tauri v2 + Rust + React 19 Workspace

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/theme.css`, `src/App.test.tsx`
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/error.rs`
- Remove: legacy Nuxt v1 root files (`app/`, `server/`, `nuxt.config.ts`, `bin/`, `commands/`, `scripts/`, `Dockerfile`, `docker-compose.yml`, `tests/`) AFTER tagging `archive/nuxt-v1` (keep `docs/`, `public/` icons, `README.md`, `LICENSE`, `.github/`).

**Interfaces:**
- Produces (Rust): `pub enum AppError` (`Io`, `Db`, `Git`, `Pty`, `NotFound`, `InvalidInput`, `External`) implementing `serde::Serialize` and `thiserror::Error`; `pub type AppResult<T> = Result<T, AppError>`.
- Produces (Config): Tauri capability `default.json` granting `core:default`, `dialog:default`, `notification:default`, `opener:default`; Vite dev port `1420` (Tauri v2 convention).

- [ ] **Step 1: Archive legacy Nuxt v1 safely**

Run:
```bash
git tag -a archive/nuxt-v1 -m "Archive legacy Nuxt v1 codebase before COGMINT v2 rewrite"
```
Expected: `git tag -l archive/nuxt-v1` prints `archive/nuxt-v1`.

- [ ] **Step 2: Remove legacy Nuxt v1 files while preserving `docs/` and brand assets**

Remove `app/`, `server/`, `tests/`, `bin/`, `commands/`, `scripts/`, `nuxt.config.ts`, `Dockerfile`, `docker-compose.yml`, `skills-lock.json`, `package-lock.json`, `bun.lockb`. Keep `docs/`, `public/`, `.git/`, `LICENSE`, `README.md`, `.github/`.

- [ ] **Step 3: Scaffold frontend config (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/styles/theme.css`)**

Install React 19, TypeScript, Vite 6, `@tailwindcss/vite` + `tailwindcss` v4, `zustand`, `lucide-react`, `@xterm/xterm`, `@xterm/addon-webgl`, `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links`, `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-opener`, and devDeps (`@tauri-apps/cli`, `vitest`, `@testing-library/react`, `jsdom`, `@types/react`, `@types/react-dom`). Define scripts: `dev`, `build`, `typecheck`, `test`, `tauri`.

- [ ] **Step 4: Scaffold `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `build.rs`, `capabilities/default.json`, `src/error.rs`, `src/lib.rs`, `src/main.rs`)**

Include crates: `tauri = "2"`, `tauri-plugin-dialog = "2"`, `tauri-plugin-notification = "2"`, `tauri-plugin-opener = "2"`, `serde`, `serde_json`, `tokio = { version = "1", features = ["full"] }`, `portable-pty = "0.9"`, `rusqlite = { version = "0.34", features = ["bundled"] }`, `notify = "8"`, `thiserror = "2"`, `uuid = { version = "1", features = ["v4"] }`, `chrono = { version = "0.4", features = ["serde"] }`, `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }`, `dirs = "6"`. Include `resources/pricing.json` in `bundle.resources`.

- [ ] **Step 5: Write smoke tests for Rust `AppError` serialization and React `App` render**

In `src-tauri/src/error.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn app_error_serializes_with_kind_and_message() {
        let json = serde_json::to_value(AppError::InvalidInput("bad branch".into())).unwrap();
        assert_eq!(json["kind"], "invalidInput");
        assert_eq!(json["message"], "bad branch");
    }
}
```
In `src/App.test.tsx`: assert `App` renders `COGMINT` shell landmark without throwing when Tauri runtime is absent.

- [ ] **Step 6: Run verification**

Run:
```bash
bun install && bun run typecheck && bun run test && cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: All typechecks, Vitest tests, and Cargo tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold COGMINT v2 Tauri v2 + Rust + React 19 workspace"
```

---

### Task 2: SQLite Journal DB, Migrations & Crash-Loop Guard

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/journal.rs`
- Create: `src-tauri/src/db/usage_cache.rs`
- Modify: `src-tauri/src/lib.rs` (register `Database` managed state)

**Interfaces:**
- Consumes: `crate::error::{AppError, AppResult}`
- Produces:
  - `pub struct Database` (thread-safe wrapper around `Mutex<Connection>`, supports `Database::open(path: &Path)` and `Database::open_in_memory()`)
  - `pub struct ProjectRecord { pub id: String, pub name: String, pub root_path: String, pub is_git_repo: bool, pub created_at: i64 }`
  - `pub struct WorkspaceRecord { pub id: String, pub project_id: String, pub name: String, pub path: String, pub branch: Option<String>, pub is_git_repo: bool, pub is_worktree: bool, pub shell_profile: Option<String> }`
  - `pub struct PaneJournalRecord { pub id: String, pub workspace_id: String, pub harness_id: String, pub title: String, pub pinned: bool, pub resume_session_id: Option<String>, pub last_summary: Option<String>, pub custom_args: Vec<String> }`
  - `pub struct BootStatus { pub safe_mode: bool, pub recent_unclean_boots: u32 }`
  - `Database::record_boot_start(&self, now_ms: i64) -> AppResult<BootStatus>`
  - `Database::mark_boot_clean(&self) -> AppResult<()>`
  - `Database::upsert_project / list_projects / delete_project`
  - `Database::upsert_workspace / list_workspaces / delete_workspace`
  - `Database::save_layout_tree(&self, workspace_id: &str, tree_json: &str) -> AppResult<()>` / `load_layout_tree(&self, workspace_id: &str) -> AppResult<Option<String>>`
  - `Database::upsert_pane / list_panes / delete_pane`
  - `Database::get_usage_file_offset / set_usage_file_offset / insert_usage_records / query_usage_records`

- [ ] **Step 1: Write failing tests in `src-tauri/src/db/journal.rs` and `src-tauri/src/db/usage_cache.rs`**

```rust
#[test]
fn test_crash_loop_guard_enters_safe_mode() {
    let db = Database::open_in_memory().unwrap();
    let b1 = db.record_boot_start(1_000).unwrap();
    assert!(!b1.safe_mode);
    let b2 = db.record_boot_start(4_000).unwrap(); // unclean within 10s
    assert!(!b2.safe_mode);
    let b3 = db.record_boot_start(8_000).unwrap(); // 2 prior unclean boots within 10s
    assert!(b3.safe_mode);
    assert_eq!(b3.recent_unclean_boots, 2);
}

#[test]
fn test_clean_boot_resets_crash_loop_counter() {
    let db = Database::open_in_memory().unwrap();
    db.record_boot_start(1_000).unwrap();
    db.mark_boot_clean().unwrap();
    let b2 = db.record_boot_start(3_000).unwrap();
    assert!(!b2.safe_mode);
    assert_eq!(b2.recent_unclean_boots, 0);
}

#[test]
fn test_workspace_layout_and_pane_roundtrip() {
    // upsert project -> workspace -> pane + layout_tree -> load & assert exact fields
}

#[test]
fn test_usage_record_deduplicates_by_harness_and_message_id() {
    // insert same (harness, session_id, message_id) twice -> count stays 1
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml db::`
Expected: FAIL (module/functions undefined).

- [ ] **Step 3: Implement `db/mod.rs`, `db/journal.rs`, `db/usage_cache.rs`**

Configure `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`. Create versioned schema tables (`schema_migrations`, `boot_history`, `projects`, `workspaces`, `panes`, `layout_trees`, `custom_harnesses`, `usage_files`, `usage_records`, `pricing_overrides`). `usage_records` has `UNIQUE(harness_id, session_id, message_id)` using `INSERT OR REPLACE` so re-reads never double-count.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml db::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db src-tauri/src/lib.rs && git commit -m "feat(db): add SQLite WAL journal, crash-loop guard, and usage cache"
```

---

### Task 3: 3-OS Shell Resolver & Real PTY Manager with `ipc::Channel`

**Files:**
- Create: `src-tauri/src/pty/shell.rs`
- Create: `src-tauri/src/pty/mod.rs`
- Create: `src-tauri/src/commands/pty_cmds.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (register `PtyManager` state & PTY commands)

**Interfaces:**
- Consumes: `crate::error::{AppError, AppResult}`, `crate::harness::attention::AttentionState` (forward-defined enum in `harness/attention.rs` or shared `PtyStreamEvent`)
- Produces:
  - `pub struct ShellProfile { pub id: String, pub label: String, pub program: String, pub args: Vec<String>, pub is_wsl: bool }`
  - `pub fn detect_available_shells() -> Vec<ShellProfile>` (Windows: `pwsh` → `powershell` → Git Bash → `cmd`; macOS/Linux: `$SHELL -l` fallback `/bin/sh`)
  - `pub fn build_wsl_command(distro: &str, windows_or_linux_cwd: &str, command_argv: &[String]) -> (String, Vec<String>)`
  - `pub fn decode_utf8_chunk(carry: &mut Vec<u8>, incoming: &[u8]) -> String`
  - `#[derive(Clone, Serialize)] #[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event", content = "data")] pub enum PtyStreamEvent { Output { data: String }, Exit { exit_code: Option<i32> }, Attention { state: String, latest_words: Option<String> } }`
  - `pub struct SpawnPtyRequest { pub pane_id: String, pub cwd: String, pub cols: u16, pub rows: u16, pub program: Option<String>, pub args: Vec<String>, pub env: HashMap<String, String>, pub shell_profile: Option<String> }`
  - `PtyManager::spawn(&self, req: SpawnPtyRequest, on_event: impl Fn(PtyStreamEvent) + Send + Sync + 'static) -> AppResult<()>`
  - `PtyManager::write(&self, pane_id: &str, data: &[u8]) -> AppResult<()>`
  - `PtyManager::resize(&self, pane_id: &str, cols: u16, rows: u16) -> AppResult<()>`
  - `PtyManager::kill(&self, pane_id: &str) -> AppResult<()>`
  - Tauri commands: `spawn_pane_pty`, `write_pty`, `resize_pty`, `kill_pty`, `detect_shells`, `list_wsl_distros`.

- [ ] **Step 1: Write failing tests in `src-tauri/src/pty/shell.rs` and `src-tauri/src/pty/mod.rs`**

```rust
#[test]
fn test_pty_utf8_boundary_buffering() {
    // "Tiếng Việt" contains multi-byte UTF-8 sequences; split mid-character
    let full = "Tiếng Việt ──▶ ok".as_bytes();
    let split = 4; // mid-codepoint of 'ế'
    let mut carry = Vec::new();
    let part1 = decode_utf8_chunk(&mut carry, &full[..split]);
    let part2 = decode_utf8_chunk(&mut carry, &full[split..]);
    assert_eq!(format!("{part1}{part2}"), "Tiếng Việt ──▶ ok");
    assert!(carry.is_empty());
}

#[test]
fn test_detect_shells_returns_at_least_one_native_shell() {
    let shells = detect_available_shells();
    assert!(!shells.is_empty());
}

#[test]
fn test_build_wsl_command_uses_distro_and_cd() {
    let (prog, args) = build_wsl_command("Ubuntu", "/home/dev/app", &["claude".into()]);
    assert_eq!(prog, "wsl.exe");
    assert_eq!(args, vec!["-d", "Ubuntu", "--cd", "/home/dev/app", "--", "claude"]);
}

#[test]
fn test_pty_kill_cleans_up_session_and_closes_channel() {
    // Spawn real lightweight echo/shell PTY, assert output received, call kill(), assert write() returns NotFound
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml pty::`
Expected: FAIL.

- [ ] **Step 3: Implement `pty/shell.rs`, `pty/mod.rs`, `commands/pty_cmds.rs`**

Use `portable_pty::native_pty_system()`. Spawn a dedicated OS reader thread per PTY that reads 4KB buffers, passes bytes through `decode_utf8_chunk`, emits `PtyStreamEvent::Output`, and emits `PtyStreamEvent::Exit` on EOF/child wait. On Windows, terminate child process tree cleanly on `kill()` (`child.kill()` + drop master/writer) so worktree directory locks are released immediately. Wire `spawn_pane_pty` to accept `on_event: tauri::ipc::Channel<PtyStreamEvent>`.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml pty::`
Expected: PASS on current OS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/pty src-tauri/src/commands src-tauri/src/lib.rs && git commit -m "feat(pty): add 3-OS portable-pty manager, shell resolver, and ipc::Channel streaming"
```

---

### Task 4: 12-Harness Catalog, Custom Harnesses & Session Resume Engine

**Files:**
- Create: `src-tauri/src/harness/mod.rs`
- Create: `src-tauri/src/harness/resume.rs`
- Create: `src-tauri/src/commands/harness_cmds.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `crate::db::Database`, `crate::error::{AppError, AppResult}`
- Produces:
  - `pub enum ResumeStrategy { ExactFlag, LatestFlag, BareRelaunch }`
  - `pub struct HarnessSpec { pub id: String, pub name: String, pub command: String, pub default_args: Vec<String>, pub resume_strategy: ResumeStrategy, pub accent_color: String, pub is_builtin: bool, pub enabled: bool }`
  - `pub fn builtin_harnesses() -> Vec<HarnessSpec>` — exact 12 built-ins: `claude`, `codex`, `opencode`, `gemini`, `copilot`, `antigravity`, `amp`, `kimi`, `kiro`, `grok`, `vibe`, `droid` (matching spec; note Codex disables idle TUI animation via `-c tui.animations=false` so attention detection stays accurate).
  - `pub fn build_launch_argv(spec: &HarnessSpec, resume_session_id: Option<&str>, new_session_id: Option<&str>, extra_args: &[String]) -> (String, Vec<String>)`
  - `pub fn resolve_latest_session_id(harness_id: &str, cwd: &Path, home_dir: &Path) -> Option<String>` (checks `~/.claude/projects/<encoded-cwd>/*.jsonl`, `~/.codex/sessions/**/*.jsonl`, `~/.local/share/opencode/`).
  - Tauri commands: `list_harnesses`, `upsert_custom_harness`, `delete_custom_harness`, `resolve_resume_session`.

- [ ] **Step 1: Write failing tests in `src-tauri/src/harness/mod.rs` and `src-tauri/src/harness/resume.rs`**

```rust
#[test]
fn test_builtin_catalog_contains_all_12_harnesses() {
    let ids: Vec<_> = builtin_harnesses().into_iter().map(|h| h.id).collect();
    for expected in ["claude", "codex", "opencode", "gemini", "copilot", "antigravity", "amp", "kimi", "kiro", "grok", "vibe", "droid"] {
        assert!(ids.contains(&expected.to_string()), "missing harness {expected}");
    }
}

#[test]
fn test_claude_launch_argv_uses_resume_or_preallocated_session_id() {
    let claude = builtin_harnesses().into_iter().find(|h| h.id == "claude").unwrap();
    let (_, args_resume) = build_launch_argv(&claude, Some("sess-123"), None, &[]);
    assert!(args_resume.windows(2).any(|w| w == ["--resume", "sess-123"]));
    let (_, args_new) = build_launch_argv(&claude, None, Some("uuid-456"), &[]);
    assert!(args_new.windows(2).any(|w| w == ["--session-id", "uuid-456"]));
}

#[test]
fn test_resolve_latest_claude_session_from_fixture_dir() {
    // Temp home dir with two JSONL files at different mtimes -> returns newest stem
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml harness::`
Expected: FAIL.

- [ ] **Step 3: Implement `harness/mod.rs`, `harness/resume.rs`, `commands/harness_cmds.rs`**

Never mutate any external harness config files. Support custom harness persistence in `Database` (`custom_harnesses` table) merged cleanly with `builtin_harnesses()`.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml harness::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/harness src-tauri/src/commands src-tauri/src/lib.rs && git commit -m "feat(harness): add 12-harness catalog, custom harnesses, and session resume engine"
```

---

### Task 5: Attention State Machine & Latest-Words Extractor

**Files:**
- Create: `src-tauri/src/harness/attention.rs`
- Modify: `src-tauri/src/pty/mod.rs` (feed PTY output & exit events into per-pane `AttentionTracker`, emit `PtyStreamEvent::Attention` on state transitions)

**Interfaces:**
- Consumes: `crate::pty::PtyStreamEvent`
- Produces:
  - `#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)] #[serde(rename_all = "snake_case")] pub enum AttentionState { Working, NeedsAttention, Idle, Done, Failed, Hibernated }`
  - `pub fn strip_ansi(input: &str) -> String`
  - `pub struct AttentionTracker`
  - `AttentionTracker::on_output(&mut self, raw_chunk: &str, now_ms: i64) -> Option<(AttentionState, Option<String>)>`
  - `AttentionTracker::on_tick(&mut self, now_ms: i64) -> Option<(AttentionState, Option<String>)>`
  - `AttentionTracker::on_exit(&mut self, exit_code: Option<i32>) -> (AttentionState, Option<String>)`
  - `pub fn extract_latest_words(harness_id: &str, session_file: &Path) -> Option<String>` (tails last 16KB of JSONL log, extracts latest non-empty assistant text truncated to 140 chars).

- [ ] **Step 1: Write failing tests in `src-tauri/src/harness/attention.rs`**

```rust
#[test]
fn test_strip_ansi_removes_csi_and_osc_sequences() {
    assert_eq!(strip_ansi("\x1b[32mAllow tool?\x1b[0m \x1b]0;title\x07(y/n)"), "Allow tool? (y/n)");
}

#[test]
fn test_attention_transitions_working_to_needs_attention_on_prompt_and_idle() {
    let mut t = AttentionTracker::new("claude");
    assert_eq!(t.on_output("Thinking...\n", 1_000).unwrap().0, AttentionState::Working);
    assert_eq!(t.on_output("Allow Bash tool? [y/N]\x07", 2_000).unwrap().0, AttentionState::NeedsAttention);
}

#[test]
fn test_attention_exit_codes_map_to_done_or_failed() {
    let mut t = AttentionTracker::new("codex");
    assert_eq!(t.on_exit(Some(0)).0, AttentionState::Done);
    assert_eq!(t.on_exit(Some(1)).0, AttentionState::Failed);
}

#[test]
fn test_extract_latest_words_truncates_and_skips_tool_only_entries() {
    // Fixture JSONL with user msg, tool_use block, and long assistant text -> returns <=140 char preview
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml harness::attention::`
Expected: FAIL.

- [ ] **Step 3: Implement `harness/attention.rs` and wire into `pty/mod.rs`**

Detect bell (`\x07`), OSC 9/777 notification sequences, interactive prompt patterns (`[y/N]`, `(y/n)`, `Allow`, `Approve`, `Press Enter`, `? `), and idle quiescence (>3s no output after working → `Idle` or `NeedsAttention` if tail looks like a question).

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml harness::attention::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/harness/attention.rs src-tauri/src/pty/mod.rs && git commit -m "feat(attention): add ANSI-aware attention state machine and latest-words extractor"
```

---

### Task 6: Git Worktree Lifecycle, `.worktreeinclude` Copy & Safe Partial-Checkout Recovery

**Files:**
- Create: `src-tauri/src/git/worktree.rs`
- Create: `src-tauri/src/git/mod.rs` (initial repo probe `is_git_repo`)

**Interfaces:**
- Consumes: `crate::error::{AppError, AppResult}`
- Produces:
  - `pub struct WorktreeInfo { pub path: String, pub branch: Option<String>, pub head_sha: Option<String>, pub is_main: bool, pub is_prunable: bool }`
  - `pub struct CreateWorktreeRequest { pub repo_root: String, pub branch: String, pub base_ref: Option<String>, pub target_dir: Option<String> }`
  - `pub struct WorktreeRecoveryReport { pub branch_exists: bool, pub dir_exists: bool, pub registered: bool, pub message: String }`
  - `pub fn list_worktrees(repo_root: &Path) -> AppResult<Vec<WorktreeInfo>>`
  - `pub fn create_worktree(req: &CreateWorktreeRequest) -> Result<WorktreeInfo, (AppError, WorktreeRecoveryReport)>`
  - `pub fn remove_worktree(repo_root: &Path, worktree_path: &Path, force: bool) -> AppResult<()>`
  - `pub fn copy_worktree_includes(repo_root: &Path, worktree_path: &Path) -> AppResult<Vec<String>>`

- [ ] **Step 1: Write failing tests in `src-tauri/src/git/worktree.rs`**

```rust
#[test]
fn test_create_list_and_remove_worktree_in_temp_git_repo() {
    // Init temp git repo with 1 commit -> create_worktree("feat/test") -> list_worktrees has 2 -> remove_worktree -> list has 1
}

#[test]
fn test_worktreeinclude_copies_valid_files_and_rejects_path_traversal() {
    // Create .worktreeinclude with ".env.local", "../outside.txt", "/etc/passwd"
    // Assert ".env.local" is copied and traversal entries return InvalidInput error without reading outside repo
}

#[test]
fn test_create_worktree_existing_dir_returns_recovery_report_without_deleting_dir() {
    // Pre-create target_dir with a sentinel file -> create_worktree fails -> recovery report has dir_exists=true AND sentinel file still exists
}

#[test]
fn test_non_git_directory_probe_returns_false_cleanly() {
    // Temp non-git dir -> is_git_repo == false
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml git::worktree::`
Expected: FAIL.

- [ ] **Step 3: Implement `git/worktree.rs`**

Invoke system `git` via `std::process::Command` with `CREATE_NO_WINDOW` flag on Windows (`0x08000000`) so no console flashes. Enforce 60s timeout on `git worktree add`. Canonicalize `.worktreeinclude` entries and verify `starts_with(repo_root)` before copying. Never auto-delete existing directories on error.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml git::worktree::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/git && git commit -m "feat(git): add safe worktree manager, .worktreeinclude copy, and recovery diagnostics"
```

---

### Task 7: Git Status, Unified Diff, Quick Commit, Merge Dry-Run & `notify` FS Watcher

**Files:**
- Modify: `src-tauri/src/git/mod.rs`
- Create: `src-tauri/src/git/merge_preview.rs`
- Create: `src-tauri/src/watcher/mod.rs`
- Create: `src-tauri/src/commands/git_cmds.rs`
- Create: `src-tauri/src/commands/workspace_cmds.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `crate::git::worktree::*`, `crate::db::Database`, `crate::error::{AppError, AppResult}`
- Produces:
  - `pub struct FileChangeEntry { pub path: String, pub status: String, pub staged: bool, pub untracked: bool }`
  - `pub struct GitStatusSummary { pub is_git_repo: bool, pub branch: Option<String>, pub ahead: u32, pub behind: u32, pub changes: Vec<FileChangeEntry> }`
  - `pub struct FileDiffResult { pub path: String, pub is_binary: bool, pub truncated: bool, pub unified_diff: String }`
  - `pub struct MergePreview { pub base_branch: String, pub ahead: u32, pub behind: u32, pub has_conflicts: bool, pub conflicting_files: Vec<String> }`
  - `pub fn get_git_status(dir: &Path) -> AppResult<GitStatusSummary>`
  - `pub fn get_file_diff(dir: &Path, rel_path: &str, staged: bool) -> AppResult<FileDiffResult>` (caps output at 256KB setting `truncated: true`, detects binary cleanly)
  - `pub fn stage_files / unstage_files / commit_changes(dir: &Path, message: &str) -> AppResult<String>`
  - `pub fn preview_merge(dir: &Path, base_branch: &str) -> AppResult<MergePreview>` (uses `git merge-tree --write-tree`)
  - `pub struct WorkspaceWatcher` (`watch(&self, workspace_id: &str, path: &Path, on_dirty: ...)` and `unwatch(&self, workspace_id: &str)`)
  - Tauri commands: `get_git_status`, `get_file_diff`, `stage_files`, `unstage_files`, `commit_changes`, `get_merge_preview`, `register_project`, `list_workspaces`, `create_worktree`, `remove_worktree`, `save_workspace_layout`, `load_workspace_journal`.

- [ ] **Step 1: Write failing tests in `git/mod.rs`, `git/merge_preview.rs`, and `watcher/mod.rs`**

```rust
#[test]
fn test_status_diff_stage_and_commit_flow() {
    // Modify tracked file + add untracked file -> get_git_status reports both -> get_file_diff contains "+new line" -> stage & commit -> status clean
}

#[test]
fn test_merge_preview_detects_conflict_without_mutating_working_tree() {
    // Create divergent commits modifying same line on main & feat -> preview_merge reports has_conflicts=true and conflicting_files=["file.txt"], working tree remains clean
}

#[test]
fn test_watcher_drops_handle_on_unwatch_allowing_directory_removal() {
    // Watch temp dir -> unwatch -> std::fs::remove_dir_all succeeds cleanly (critical on Windows)
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml git:: && cargo test --manifest-path src-tauri/Cargo.toml watcher::`
Expected: FAIL.

- [ ] **Step 3: Implement `git/mod.rs`, `git/merge_preview.rs`, `watcher/mod.rs`, and commands**

Ensure `remove_worktree` IPC command calls `watcher.unwatch(&workspace_id)` BEFORE invoking `git worktree remove`, preventing Windows file-lock errors. Debounce `notify` events by 250ms and ignore `.git/` and `node_modules/`/`target/` noise.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml git:: && cargo test --manifest-path src-tauri/Cargo.toml watcher::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/git src-tauri/src/watcher src-tauri/src/commands src-tauri/src/lib.rs && git commit -m "feat(git,watcher): add diff/commit/merge-preview engine and debounced notify watcher"
```

---

### Task 8: External Editor Launcher & Cross-Platform File-Link Parser

**Files:**
- Create: `src-tauri/src/editor/mod.rs`
- Create: `src-tauri/src/commands/editor_cmds.rs`
- Create: `src/lib/linkMatcher.ts`
- Create: `src/lib/linkMatcher.test.ts`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Produces (Rust):
  - `pub enum EditorPreset { VsCode, Cursor, Zed, Custom(String) }`
  - `pub fn build_editor_argv(preset: &EditorPreset, path: &Path, line: Option<u32>, col: Option<u32>) -> AppResult<(String, Vec<String>)>`
  - `pub fn open_in_editor(preset: &EditorPreset, path: &Path, line: Option<u32>, col: Option<u32>) -> AppResult<()>`
  - Tauri command: `open_in_editor`
- Produces (TS):
  - `export interface MatchedFileLink { raw: string; path: string; line?: number; col?: number; startIndex: number; endIndex: number }`
  - `export function findFileLinks(lineText: string): MatchedFileLink[]`

- [ ] **Step 1: Write failing tests (Rust + Vitest)**

In `src-tauri/src/editor/mod.rs`:
```rust
#[test]
fn test_editor_launcher_no_shell_injection() {
    let (prog, args) = build_editor_argv(&EditorPreset::VsCode, Path::new("C:\\My Repo\\a;rm -rf.ts"), Some(42), Some(5)).unwrap();
    assert_eq!(prog, "code");
    assert_eq!(args, vec!["--goto", "C:\\My Repo\\a;rm -rf.ts:42:5"]);
}
```
In `src/lib/linkMatcher.test.ts`:
```ts
test('test_link_matcher_windows_paths_with_spaces', () => {
  const links = findFileLinks('Error at "C:\\Users\\My Name\\repo\\src\\app.tsx:42:10" failed');
  expect(links).toHaveLength(1);
  expect(links[0]).toMatchObject({ path: 'C:\\Users\\My Name\\repo\\src\\app.tsx', line: 42, col: 10 });
});
test('parses POSIX absolute and relative file:line links', () => {
  const links = findFileLinks('See ./src/lib/splitTree.ts:88 and /home/dev/main.rs:12:3');
  expect(links).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml editor:: && bun run test src/lib/linkMatcher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src-tauri/src/editor/mod.rs`, `commands/editor_cmds.rs`, and `src/lib/linkMatcher.ts`**

Spawn editors directly via `Command::new(prog).args(args)` (never through `sh -c` or `cmd /c`). On Windows for `.cmd` shims like `code.cmd`/`cursor.cmd`, resolve executable via PATH lookup rather than shell string concatenation.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml editor:: && bun run test src/lib/linkMatcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/editor src-tauri/src/commands src/lib/linkMatcher.ts src/lib/linkMatcher.test.ts src-tauri/src/lib.rs && git commit -m "feat(editor): add safe 3-OS external editor launcher and PTY file-link matcher"
```

---

### Task 9: Up-to-Date Model Pricing Catalog & Incremental Local Log Parsers

**Files:**
- Create: `src-tauri/resources/pricing.json`
- Create: `src-tauri/src/usage/pricing.rs`
- Create: `src-tauri/src/usage/parsers/mod.rs`
- Create: `src-tauri/src/usage/parsers/claude.rs`
- Create: `src-tauri/src/usage/parsers/codex.rs`
- Create: `src-tauri/src/usage/parsers/opencode.rs`
- Create: `src-tauri/src/usage/mod.rs`
- Create: `src-tauri/src/commands/usage_cmds.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `crate::db::Database`, `crate::error::{AppError, AppResult}`
- Produces:
  - `pub struct ModelPrice { pub model_id: String, pub provider: String, pub input_per_mtok: f64, pub output_per_mtok: f64, pub cache_read_per_mtok: f64, pub cache_write_per_mtok: f64 }`
  - `pub struct UsageRecord { pub harness_id: String, pub session_id: String, pub message_id: String, pub project_path: Option<String>, pub model_id: String, pub timestamp_ms: i64, pub input_tokens: u64, pub output_tokens: u64, pub cache_read_tokens: u64, pub cache_write_tokens: u64 }`
  - `pub struct UsageSummary { pub total_cost_usd: f64, pub total_input_tokens: u64, pub total_output_tokens: u64, pub total_cache_read_tokens: u64, pub total_cache_write_tokens: u64, pub by_harness: Vec<HarnessUsage>, pub by_model: Vec<ModelUsage>, pub by_day: Vec<DailySpend>, pub pricing_updated_at: String }`
  - `PricingCatalog::resolve(&self, raw_model: &str) -> Option<&ModelPrice>` (exact match → date-suffix stripped → family alias match; user overrides take precedence)
  - `PricingCatalog::compute_cost(&self, rec: &UsageRecord) -> f64`
  - `parse_claude_jsonl_incremental(path: &Path, start_offset: u64) -> AppResult<(Vec<UsageRecord>, u64)>`
  - `parse_codex_jsonl_incremental(path: &Path, start_offset: u64) -> AppResult<(Vec<UsageRecord>, u64)>`
  - `parse_opencode_logs(base_dir: &Path) -> AppResult<Vec<UsageRecord>>`
  - Tauri commands: `get_usage_summary`, `refresh_pricing`, `list_pricing`, `set_pricing_override`.

- [ ] **Step 1: Write failing tests in `usage/pricing.rs`, `usage/parsers/claude.rs`, `usage/parsers/codex.rs`, `usage/mod.rs`**

```rust
#[test]
fn test_pricing_resolves_dated_model_ids_and_computes_cache_costs() {
    let cat = PricingCatalog::bundled();
    let price = cat.resolve("claude-sonnet-4-5-20250929").expect("sonnet price");
    let cost = cat.compute_cost(&UsageRecord {
        input_tokens: 1_000_000, output_tokens: 1_000_000,
        cache_read_tokens: 1_000_000, cache_write_tokens: 0,
        model_id: "claude-sonnet-4-5-20250929".into(), ..default_rec()
    });
    assert!((cost - (price.input_per_mtok + price.output_per_mtok + price.cache_read_per_mtok)).abs() < 1e-6);
}

#[test]
fn test_claude_parser_handles_truncated_line_and_deduplicates_request_id() {
    // Write 2 valid lines with SAME message_id (updated token count) + 1 trailing truncated line without '\n'
    // Assert parser returns only complete lines, advances offset ONLY to last '\n', and DB upsert keeps 1 deduplicated record
}

#[test]
fn test_usage_summary_returns_zero_with_no_mock_data_when_empty() {
    let db = Database::open_in_memory().unwrap();
    let summary = aggregate_usage(&db, &PricingCatalog::bundled(), 30).unwrap();
    assert_eq!(summary.total_cost_usd, 0.0);
    assert!(summary.by_day.is_empty());
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml usage::`
Expected: FAIL.

- [ ] **Step 3: Create `resources/pricing.json` and implement `usage/` modules + `usage_cmds.rs`**

Populate `pricing.json` with current Anthropic (Opus/Sonnet/Haiku 4.x), OpenAI (GPT-5/o3/o4-mini/Codex), and Google (Gemini 2.5/3 Pro & Flash) rates. `refresh_pricing` performs an unauthenticated HTTPS GET to a configurable public JSON URL, validates schema before atomically replacing cached pricing, and falls back to bundled `pricing.json` if offline. Never touch any CLI auth tokens.

- [ ] **Step 4: Run tests to verify pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml usage::`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/resources/pricing.json src-tauri/src/usage src-tauri/src/commands src-tauri/src/lib.rs && git commit -m "feat(usage): add model pricing catalog and incremental Claude/Codex/OpenCode log parsers"
```

---

### Task 10: Frontend Core — Typed IPC Bridge, Pure Split-Pane Tree, 3-OS Keybindings & Zustand Stores

**Files:**
- Create: `src/types/ipc.ts`, `src/types/workspace.ts`, `src/types/usage.ts`
- Create: `src/lib/tauri.ts`, `src/lib/splitTree.ts`, `src/lib/splitTree.test.ts`, `src/lib/keybindings.ts`
- Create: `src/stores/useWorkspaceStore.ts`, `src/stores/useWorkspaceStore.test.ts`, `src/stores/useSettingsStore.ts`

**Interfaces:**
- Consumes: Rust IPC command names & DTO shapes from Tasks 2–9.
- Produces:
  - `export type SplitNode = { type: 'leaf'; id: string; paneIds: string[]; activePaneId: string | null } | { type: 'split'; id: string; direction: 'horizontal' | 'vertical'; ratio: number; first: SplitNode; second: SplitNode }`
  - `splitLeaf(tree: SplitNode, leafId: string, direction: 'horizontal' | 'vertical', newPaneId: string): SplitNode`
  - `closePaneFromTree(tree: SplitNode, paneId: string): SplitNode | null` (collapses empty sibling automatically)
  - `reorderTabInLeaf(tree: SplitNode, leafId: string, fromIdx: number, toIdx: number, pinnedIds: Set<string>): SplitNode` (keeps pinned tabs first)
  - `useWorkspaceStore`: manages `projects`, `workspaces`, `activeWorkspaceId`, `treesByWorkspaceId`, `panesById` (each pane has `attentionState: 'working' | 'needs_attention' | 'idle' | 'done' | 'failed' | 'hibernated'`, `unread: boolean`, `unavailable?: boolean`), `jumpToNextAttention()`, `restoreFromJournal(journal, missingPaths)`.

- [ ] **Step 1: Write failing tests in `src/lib/splitTree.test.ts` and `src/stores/useWorkspaceStore.test.ts`**

```ts
test('splitLeaf splits target leaf and closePaneFromTree collapses sibling cleanly', () => {
  const root: SplitNode = { type: 'leaf', id: 'l1', paneIds: ['p1'], activePaneId: 'p1' };
  const split = splitLeaf(root, 'l1', 'vertical', 'p2');
  expect(split.type).toBe('split');
  const collapsed = closePaneFromTree(split, 'p2');
  expect(collapsed).toEqual({ type: 'leaf', id: 'l1', paneIds: ['p1'], activePaneId: 'p1' });
});

test('test_restore_marks_missing_worktree_as_unavailable_without_throwing', () => {
  // Restore journal containing workspace whose path is in missingPaths -> sets workspace.unavailable = true and keeps all panes hibernated
});

test('jumpToNextAttention focuses highest-priority needs_attention or failed pane and marks it read', () => {
  // Two panes: one working, one needs_attention -> jumpToNextAttention activates its workspace & pane and clears unread
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test src/lib/splitTree.test.ts src/stores/useWorkspaceStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/types/*`, `src/lib/*`, and `src/stores/*`**

Ensure `keybindings.ts` normalizes `metaKey` on macOS and `ctrlKey` on Windows/Linux (`Mod+T`, `Mod+Shift+A`, `Mod+D`, `Mod+Shift+D`, `Mod+Shift+B`, `Mod+Shift+U`, `Mod+K`).

- [ ] **Step 4: Run tests & typecheck**

Run: `bun run typecheck && bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types src/lib src/stores && git commit -m "feat(ui-core): add typed Tauri IPC bridge, split-pane tree engine, and workspace stores"
```

---

### Task 11: Frontend Stage & Attention Rail — AppShell, SplitStage, WebGL TerminalPane & Lazy Resume

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `src/components/layout/StatusBar.tsx`, `src/components/layout/CommandPalette.tsx`
- Create: `src/components/rail/AttentionRail.tsx`, `src/components/rail/WorktreeCard.tsx`
- Create: `src/components/stage/SplitStage.tsx`, `src/components/stage/PaneTabBar.tsx`, `src/components/stage/TerminalPane.tsx`, `src/components/stage/LaunchHarnessModal.tsx`
- Create: `src/components/stage/TerminalPane.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useWorkspaceStore`, `useSettingsStore`, `src/lib/tauri.ts`, `src/lib/linkMatcher.ts`, `src/lib/keybindings.ts`.
- Produces: Interactive 3-column workstation shell; live WebGL `xterm.js` pane (auto-falls back to Canvas renderer if WebGL context unavailable); `hibernated` overlay with one-click / `Enter` activation calling `spawn_pane_pty` with resolved resume ID; OS notification via `@tauri-apps/plugin-notification` when a pane transitions to `needs_attention` or `failed` while window is unfocused.

- [ ] **Step 1: Write failing component test in `src/components/stage/TerminalPane.test.tsx`**

```tsx
test('hibernated pane renders resume prompt without spawning PTY until activated', async () => {
  // Render TerminalPane with attentionState='hibernated', lastSummary='Refactored auth'
  // Assert spawnPanePty mock NOT called on mount -> click "Resume Session" -> assert spawnPanePty called once with pane's resumeSessionId
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test src/components/stage/TerminalPane.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement Layout, Rail, and Stage components**

Apply the dark-first precision instrument design tokens (`#0B0F17` base, cobalt `#2F6FFF` accent, crisp 1px subtle borders, clear semantic status dots: amber = `needs_attention`, blue pulse = `working`, emerald = `done`, rose = `failed`, slate = `hibernated`). Wire `Cmd/Ctrl+Click` link provider on `xterm.js` to `openInEditor`.

- [ ] **Step 4: Run tests & typecheck**

Run: `bun run typecheck && bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout src/components/rail src/components/stage src/App.tsx && git commit -m "feat(ui): add Attention Rail, worktree-scoped SplitStage, WebGL TerminalPane, and lazy resume"
```

---

### Task 12: Frontend Diff Drawer, Worktree Modal, Usage Dashboard & Settings Modal

**Files:**
- Create: `src/components/git/ChangesDrawer.tsx`, `src/components/git/UnifiedDiffView.tsx`, `src/components/git/CreateWorktreeModal.tsx`
- Create: `src/components/usage/UsageDashboard.tsx`, `src/components/usage/PricingSettingsModal.tsx`
- Create: `src/components/settings/SettingsModal.tsx`
- Create: `src/components/usage/UsageDashboard.test.tsx`, `src/components/git/ChangesDrawer.test.tsx`
- Modify: `src/components/layout/AppShell.tsx` (mount ChangesDrawer, UsageDashboard modal/view, SettingsModal, CreateWorktreeModal)

**Interfaces:**
- Consumes: `src/lib/tauri.ts` (`getGitStatus`, `getFileDiff`, `stageFiles`, `unstageFiles`, `commitChanges`, `getMergePreview`, `createWorktree`, `removeWorktree`, `getUsageSummary`, `refreshPricing`, `setPricingOverride`, `upsertCustomHarness`).
- Produces: Complete read-only Files/Changes drawer (gracefully disabled for non-Git folders), unified diff view with binary/truncated guards + Open in Editor button, safe worktree creation/recovery modal, real Usage & Cost dashboard with zero mock data + budget pace bar, Settings modal (shell, external editor, custom harnesses, Windows WSL2 distros).

- [ ] **Step 1: Write failing tests in `UsageDashboard.test.tsx` and `ChangesDrawer.test.tsx`**

```tsx
test('UsageDashboard renders empty state with zero mock figures when total_cost_usd is 0 and by_day is empty', () => {
  // Assert no fake numbers or placeholder sessions; renders guidance text
});

test('ChangesDrawer shows non-git empty state without calling git diff when workspace.isGitRepo is false', () => {
  // Assert "Not a Git repository" message and stage/commit controls hidden
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test src/components/usage/UsageDashboard.test.tsx src/components/git/ChangesDrawer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement Git, Usage, and Settings components and wire into `AppShell.tsx`**

Ensure `ChangesDrawer` subscribes to `workspace:dirty` Tauri events for the active workspace and refreshes status/merge-preview automatically. Ensure `CreateWorktreeModal` surfaces `WorktreeRecoveryReport` details cleanly on failure without any destructive auto-retry.

- [ ] **Step 4: Run tests, typecheck, and production frontend build**

Run: `bun run typecheck && bun run test && bun run build`
Expected: All PASS with zero TS errors and clean Vite bundle.

- [ ] **Step 5: Commit**

```bash
git add src/components/git src/components/usage src/components/settings src/components/layout/AppShell.tsx && git commit -m "feat(ui): add read-only Diff drawer, worktree modal, real Usage dashboard, and Settings"
```

---

### Task 13: 3-OS CI/CD Workflows & Full Local Verification

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md` (update to reflect COGMINT v2 Tauri architecture, 3-OS build & dev commands)

**Interfaces:**
- Produces:
  - `.github/workflows/ci.yml`: 3-OS matrix (`windows-latest`, `macos-latest`, `ubuntu-latest` with Linux WebKitGTK deps `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`) running `bun run typecheck`, `bun run test`, `bun run build`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, and `cargo test --manifest-path src-tauri/Cargo.toml`.
  - `.github/workflows/release.yml`: Tag-triggered (`v*`) 3-OS `tauri-apps/tauri-action@v0` release builder producing Windows (`.msi`/`.exe`), macOS (`.dmg`), and Linux (`.AppImage`/`.deb`) artifacts + SHA256 checksums.

- [ ] **Step 1: Update `.github/workflows/ci.yml` and `.github/workflows/release.yml` for 3-OS Tauri v2 builds**

Ensure Linux job installs `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` before Cargo build/test.

- [ ] **Step 2: Update `README.md` for COGMINT v2**

Document features, 12 built-in harnesses, 3-OS prerequisites, dev commands (`bun run tauri dev`), test commands, and link to `archive/nuxt-v1` tag for legacy v1 users.

- [ ] **Step 3: Run full local verification suite**

Run:
```bash
bun run typecheck && bun run test && bun run build && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: All 5 checks PASS cleanly with exit code 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml README.md && git commit -m "ci: add 3-OS Tauri v2 CI matrix, release bundler, and v2 README"
```
