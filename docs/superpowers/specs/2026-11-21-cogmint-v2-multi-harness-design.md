# COGMINT v2 — Multi-Harness Agent Workstation (Design Spec)

**Date:** 2026-11-21
**Status:** Finalized (Ready for Implementation Plan)
**Target Platforms:** Windows (x64/arm64), macOS (arm64/x64), Linux (x64/arm64)

---

## 1. Intent & Why

COGMINT v1 was a Nuxt 4 web control plane coupled tightly to `~/.claude` and `@anthropic-ai/claude-agent-sdk`. In practice, modern AI-assisted development is no longer single-tool: developers run **Claude Code, Codex, OpenCode, Gemini CLI, Copilot CLI, and custom CLI agents** side-by-side across multiple projects and concurrent tasks.

COGMINT v2 is a ground-up redesign and rewrite into a **native, local-first, 3-OS Multi-Harness Agent Workstation**. It synthesizes the strongest architectural and UX patterns from the ecosystem (`SpaceVibe Deck`, `FORGE`, `Parallel Code`, `OpenQuota`) into a single lightweight desktop application with zero telemetry and zero lock-in to any single AI provider.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **First-class 3-OS Native Desktop App:** Fast startup, low memory footprint (<80MB idle), native installers/packages for Windows, macOS, and Linux via Tauri v2 + Rust.
- **Multi-Harness Parallel Execution:** Run multiple coding CLI agents (Claude Code, Codex, OpenCode, Gemini CLI, and user-defined CLIs) concurrently in real PTYs, side-by-side in split panes or tabs.
- **Git Worktree Isolation:** Spin up isolated Git worktrees per task/agent so concurrent agents never collide on files, lockfiles, or git index, with safe recovery if checkout is interrupted.
- **Attention-First Supervision ("Agent Rail"):** Surface which agent is `working`, `needs_attention` (waiting for input/approval), `done`, or `failed` across all projects and worktrees, with latest-message previews and native OS notifications.
- **Built-In Diff & File Surface:** Review changed files per worktree, inspect diffs (read-only), stage/commit changes, and jump to external editors (`Cmd/Ctrl+Click` on `path:line:col`) for editing.
- **Accurate Local Usage, Token & Cost Accounting:** Parse real local session logs across supported harnesses, map model IDs to an up-to-date pricing catalog (input/output/cache tokens → USD), and track spend against optional user-set budget thresholds — strictly local-only (no CLI OAuth token reading) with **zero mock data**.
- **Exact/Best-Effort Session Resume:** Journal open workspaces, panes, and harness session IDs locally so restarting the app restores workspaces and resumes conversations cleanly.

### Non-Goals (for v1 of COGMINT v2)
- Cloud sync, user accounts, team collaboration, or mobile companion apps.
- Replacing each CLI's native TUI/agent loop with a custom chat SDK wrapper (agents run in real PTYs so 100% of upstream CLI features work out of the box).
- Visual drag-and-drop multi-agent node workflows (VueFlow) or `~/.claude`-specific Agent Studio / Relationship Graph from COGMINT v1 (may be revisited as optional plugins in v2.x).
- Built-in telemetry or crash reporting phones-home.

### Anti-Goals (Failure Conditions)
- Bundling Electron or requiring Node.js/Bun on the end user's machine to run the packaged app.
- Silently deleting or overwriting partial/dirty Git worktrees on error.
- Shipping hardcoded stale pricing or fake/mock analytics data.
- Locking the UX or data model to Claude Code alone.

---

## 3. Constraints

- **Toolchains Verified Locally:** `rustc 1.96.0`, `cargo 1.96.0`, `node v26.3.0`, `bun 1.4.4`, `git 2.54.0` (Windows).
- **Local-First & Zero Telemetry:** No external backend, no mandatory API keys inside COGMINT (harnesses use their own local CLI auth/subscriptions), no Sentry/Supabase/analytics beacons.
- **Cross-Platform PTY:** Must use Rust `portable-pty` (ConPTY on Windows, `openpty` on macOS/Linux) — never `node-pty`.
- **Clean Repo Transition:** Before replacing the root workspace with the Tauri v2 codebase, preserve the existing Nuxt v1 codebase via a git tag/branch (`archive/nuxt-v1`) so history is never lost.

---

## 4. Approaches Considered

| Approach | Stack | Trade-offs | Decision |
|---|---|---|---|
| **A. Fork `mxrsv/spacevibe-deck`** | Electron 43 + Preact + `node-pty` | Fastest path to existing features, but heavy Electron RAM footprint, `node-pty` Windows/Linux build friction, no Linux builds, baked-in Sentry/Supabase telemetry to strip. | Rejected |
| **B. Clean-Slate Rewrite (Tauri v2)** | **Tauri v2 (Rust) + React 19 + TypeScript + Tailwind v4** | Lightest memory footprint, true 3-OS native PTY (`portable-pty`) & FS watcher (`notify`), clean modular harness/usage architecture, zero inherited telemetry or tech debt. Higher upfront build effort. | **Selected** |
| **C. Fork a Tauri worktree app (`corral`/`forge`)** | Tauri v2 + React/Node sidecar | Already Tauri, but locked to Claude Code (`forge`) or less mature multi-harness UX (`corral`), requiring heavy rewrites anyway. | Rejected |

**Why Approach B won:** The user explicitly prioritized the most optimal, cleanest, 3-OS native architecture without legacy constraints. Using `spacevibe-deck`, `FORGE`, and `OpenQuota` as architectural references while building clean on Tauri v2 + Rust + React/TS delivers the best runtime performance and long-term maintainability.

---

## 5. System Architecture

### 5.1 High-Level Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (Vite + React 19 + TypeScript + Tailwind v4 + Zustand)    │
│  ┌───────────────┐ ┌───────────────────────────┐ ┌───────────────┐  │
│  │ Attention Rail│ │ Stage (Split PTY Panes,   │ │ Usage & Cost  │  │
│  │ (Projects /   │ │  Files/Diff, Quick Commit)│ │ Dashboard     │  │
│  │  Worktrees)   │ │  xterm.js (WebGL) + Diff  │ │ + Pricing     │  │
│  └───────────────┘ └───────────────────────────┘ └───────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Tauri IPC Commands + Binary/Text Channels
┌───────────────────────────────▼─────────────────────────────────────┐
│  Rust Core (src-tauri/) — Tokio Async Runtime                       │
│  ├── pty_manager     (portable-pty, ConPTY/openpty, resize, kill)   │
│  ├── harness_engine  (catalog, attention parser, session resolver)  │
│  ├── git_worktree    (worktree CRUD, status, diff, safe recovery)   │
│  ├── fs_watcher      (notify crate, debounced change events)        │
│  ├── usage_engine    (log parsers, pricing catalog, cost/quota agg) │
│  └── journal_db      (rusqlite: workspace layout, resume IDs, cache)│
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Core Modules

#### 1) Harness Catalog & Adapter Engine (`src-tauri/src/harness/`)
A declarative + trait-based `HarnessAdapter` architecture:
- **Built-in Harnesses (v1):**
  - **Claude Code** (`claude`) — exact session resume (`--resume <id>`), JSONL log parser (`~/.claude/projects/`), attention state + latest words extraction.
  - **Codex CLI** (`codex`) — exact session resume, local log parser (`~/.codex/sessions/`), attention state + latest words.
  - **OpenCode** (`opencode`) — exact session resume, local session/SQLite/JSON log parser (`~/.local/share/opencode/`), attention state + latest words.
  - **Gemini CLI** (`gemini`) — latest session resume, attention state detection.
  - **Additional Built-ins (launchable out of the box, bare/best-effort resume):** GitHub Copilot CLI (`copilot`), Antigravity (`agy`), Amp (`amp`), Kimi (`kimi`), Kiro (`kiro-cli`), Grok (`grok`), Mistral Vibe (`vibe`), Droid (`droid`).
  - **Custom Harnesses:** User-defined name, icon/color, executable command, default args, and optional env vars stored in local settings.
- **Attention State Machine:** Combines PTY output activity heuristics (idle timeout, prompt patterns, bell/OSC sequences, non-zero exit) with harness-specific session log tailing to classify each pane into: `working`, `needs_attention`, `idle`, `done`, `failed`.

#### 2) PTY Manager (`src-tauri/src/pty/`)
- Uses `portable-pty` over user's real login shell (`pwsh`/`powershell` or `cmd`/Git Bash configurable on Windows; `$SHELL -l` on macOS/Linux) so PATH, aliases, SSH keys, and CLI auth work identically to a native terminal.
- Streams PTY bytes to the frontend via Tauri v2 `ipc::Channel` (avoiding global event-bus overhead when 10+ panes output simultaneously).
- Supports clean resize, graceful `SIGTERM`/Ctrl+C, and force kill on pane close.

#### 3) Git Worktree & Diff Engine (`src-tauri/src/git/`)
- **Worktree Creation:** `git worktree add <path> -b <branch>` under a predictable sibling/managed directory (configurable). Supports optional `.worktreeinclude` file copy (e.g., `.env.local`) into new worktrees.
- **Crash/Interrupt Safety:** If worktree creation times out or fails midway, inspect `git worktree list` and target directory state and report actionable recovery options; never auto-delete an unverified directory.
- **Changes & Diff:** Fast `git status --porcelain=v2` + unified diff provider per worktree, refreshed via `notify` filesystem watcher (debounced). Supports staging/unstaging, quick commit, branch rebase/merge preview, and worktree cleanup.

#### 4) Local Usage, Model Pricing & Quota Engine (`src-tauri/src/usage/`)
- **Log Parsers:** Incremental parsers (tracking file mtime/byte offset in SQLite so re-scans take milliseconds) for Claude Code, Codex, and OpenCode local session logs.
- **Up-to-Date Model Pricing Catalog:**
  - Bundled `pricing.json` with latest Anthropic, OpenAI, Google, and open-model token prices (input, output, cache_read, cache_write per 1M tokens).
  - Optional one-click / periodic refresh from a public pricing JSON source (e.g. LiteLLM / official catalog) cached locally, plus user override support.
- **Metrics & Quota Surface:**
  - Breakdown by **Harness**, **Model**, **Project**, and **Day/Week/Month** (real tokens + USD cost).
  - Where a harness exposes rolling rate-limit/usage windows locally (e.g., 5-hour / 7-day windows), compute current utilization % and burn pace.
  - Zero mock data — empty state cleanly explains how to run a session to start tracking.

#### 5) Session Journal & Persistence (`src-tauri/src/db/`)
- Local SQLite database (`rusqlite`, WAL mode) in OS app-data dir storing:
  - Registered projects, worktree metadata, split-pane layout tree, pinned tabs, and active harness session IDs.
  - Crash-loop guard on startup (if the app crashes twice within 10s of boot, offer safe-mode restore).
  - Incremental usage cache indexed by `(harness, session_id, timestamp, model)`.
- Native CLI files remain the sole source of truth for actual conversation transcripts.

### 5.3 Frontend Architecture (`src/`)
- **Framework:** Vite 6 + React 19 + TypeScript (strict) + Tailwind CSS v4.
- **State:** Zustand for workspace/pane/rail state; TanStack Query (or lightweight async hooks) for Git diffs & Usage dashboard queries.
- **UI Primitives:**
  - **Left Rail (Attention Rail):** Collapsible project → worktree → agent pane list with color-coded attention dots, latest words snippet, unread badge, and quick `+ New Worktree` / `+ New Agent` actions.
  - **Main Stage:** Split-pane layout engine (horizontal/vertical splits, resizable gutters, draggable/pinnable tabs) hosting:
    - **Terminal Surface:** `@xterm/xterm` + WebGL addon + Fit/Search/WebLinks + custom `Cmd/Ctrl+Click` file-path link provider (`path:line:col` → open in built-in viewer or external editor).
    - **Files & Diff Surface:** File tree + Changes filter + side-by-side/inline diff viewer (Monaco Editor or lightweight CodeMirror/Shiki diff).
  - **Usage & Cost View:** Clean dashboard & compact top-bar/status-bar indicator showing today's spend, active models, and per-harness breakdown.
  - **Keyboard-First Navigation:** `Cmd/Ctrl+T` launch agent, `Cmd/Ctrl+Shift+A` jump to next pane needing attention, `Cmd/Ctrl+D` split pane, `Cmd/Ctrl+Shift+U` usage view, `Cmd/Ctrl+K` command palette.

---

## 6. Resolved Architectural Decisions (v1 Defaults)

1. **Stage & Worktree Ownership:** Main Stage split-pane tree and Files/Diff drawer are scoped per workspace/worktree (`workspace_id`). Clicking a worktree or project root in the Attention Rail swaps to that workspace's split tree. Non-Git folders and main checkouts are first-class workspaces (`is_git_repo: false` gracefully disables Git/Diff controls without errors).
2. **Session Binding & Attention Detection (Zero-Mutation Hybrid):** COGMINT may pass safe CLI flags when launching a harness (e.g. `--session-id <uuid>` / `--resume <id>` for Claude Code) and combines PTY output heuristics (idle timeout, bell/OSC, exit code) with passive local session-log tailing. It never silently mutates `~/.claude/settings.json` or other harness config files.
3. **Read-Only Diff Surface:** v1 provides a fast read-only Files & Unified Diff viewer (avoiding Monaco's memory cost and concurrent write conflicts with live agents), with one-click external editor opening (`VS Code`, `Cursor`, `Zed`, or custom `{path}:{line}:{col}` template).
4. **Local-Only Usage & Pricing:** `usage_engine` only reads local session logs and maps models via bundled + refreshable `pricing.json` (unauthenticated HTTPS fetch, offline fallback, user overrides). Never reads CLI OAuth tokens or calls private provider quota endpoints. Optional user-configured daily/monthly USD budget caps drive pace warnings.
5. **Lazy / Dormant Startup Restore:** Journaled panes restore in a `hibernated` state (showing last captured summary + "Press Enter / Click to Resume") and only spawn PTYs when activated, preserving `<80MB` idle RAM and preventing unintended agent execution on boot.
6. **Windows Shell Support:** Native Windows shells (`pwsh` → `powershell` → `cmd`, or user-configured Git Bash) run natively via ConPTY. Projects may optionally select a WSL2 shell profile (`wsl.exe -d <distro>`) for terminal launch; full WSL 9P log-syncing is deferred to v1.1.
7. **Git Operations Scope:** v1 supports worktree creation/listing/safe-removal, `.worktreeinclude` copy, `git status`, unified file diffs, stage/unstage, quick commit, and read-only ahead/behind + merge-conflict dry-run (`git merge-tree --write-tree`). Interactive conflict resolution is deferred to v1.1.

---

## 7. Phased Delivery Roadmap (High-Level)

1. **Phase 0 — Archive & Scaffold:** Tag/archive Nuxt v1 (`archive/nuxt-v1`), scaffold Tauri v2 + Rust + Vite/React 19 + Tailwind v4 workspace, configure CI matrix (Windows, macOS, Linux).
2. **Phase 1 — Core PTY & Multi-Harness Stage:** `portable-pty` backend, `ipc::Channel` streaming, `xterm.js` WebGL panes, split-pane layout, 12-harness catalog + custom harness config.
3. **Phase 2 — Git Worktree & Attention Rail:** Worktree CRUD + `.worktreeinclude` copy, `notify` watcher, Attention Rail state machine + OS notifications + session journaling & resume.
4. **Phase 3 — Files/Diff Surface & Editor Integration:** Worktree Files/Changes panel, diff viewer, quick commit, `Cmd/Ctrl+Click` external editor jump.
5. **Phase 4 — Real Usage, Cost & Pricing Engine:** Incremental log parsers (Claude Code, Codex, OpenCode), updatable model pricing catalog, Usage/Cost dashboard & status bar widget.

---

## 8. What's Left to the Builder

- Exact read-only diff rendering library (Shiki or lightweight unified diff component) optimizing bundle size and startup speed.
- Exact split-pane tree data structure and drag-and-drop library choice.
- Specific Tailwind v4 design tokens (keeping the dark-first precision aesthetic).
- CI signing/notarization secrets setup (provide unsigned 3-OS build workflows ready for signing keys).
- Exact SQLite schema migrations and log-parser edge-case fixtures.
