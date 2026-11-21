<div align="center">

<p align="center">
  <img src="public/favicon.svg" alt="COGMINT Logo" width="76" height="76" />
</p>

# COGMINT v2

<p>
  <strong>Native 3-OS Multi-Harness AI Coding Agent Workstation.</strong>
</p>

<p>
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-Core-000000?style=for-the-badge&logo=rust&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-2F6FFF?style=for-the-badge&logo=react&logoColor=white">
  <img alt="3 OS" src="https://img.shields.io/badge/OS-Windows%20%7C%20macOS%20%7C%20Linux-05DCA3?style=for-the-badge">
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-64748B?style=for-the-badge"></a>
</p>

</div>

---

## What is COGMINT v2?

COGMINT v2 is a **local-first, zero-telemetry desktop workstation** built on **Tauri v2 (Rust) + React 19 + Tailwind CSS v4 + WebGL `xterm.js`** for running multiple AI coding CLI agents side-by-side in isolated Git worktrees across **Windows, macOS, and Linux**.

### Key Features

- **20 Built-In CLI Harnesses + Unlimited Custom CLIs (Auto-Detected):**
  - Automatically scans your OS `PATH` (and Windows `.cmd`/`.exe` shims) to surface only installed CLIs first, with bundled official brand logos (100% offline):
    **Claude Code** (`claude`), **Codex CLI** (`codex`), **OpenCode** (`opencode`), **Gemini CLI** (`gemini`), **Cursor Agent** (`cursor-agent`), **Copilot CLI** (`copilot`), **Antigravity** (`agy`), **Aider** (`aider`), **Cline CLI** (`cline`), **Qwen Code** (`qwen`), **Goose** (`goose`), **Kilo Code** (`kilocode`), **Roo Code** (`roo`), **Amp** (`amp`), **Kimi Code** (`kimi`), **Kiro CLI** (`kiro-cli`), **Grok Build** (`grok`), **Mistral Vibe** (`vibe`), **Factory Droid** (`droid`), and **Amazon Q** (`q chat`).
  - **Extensible Custom CLI Manager:** Add, edit, enable/disable, pick icon presets/accent colors, and **Export/Import JSON** for any custom or internal CLI agent.
- **Multi-Harness Auth, One-Click OAuth Sign-In & Per-PTY API Key/Proxy Profiles:**
  - Live read-only detection of OAuth credentials, OS environment variables, and COGMINT profiles — **never exposes raw OAuth tokens and never mutates external CLI config files**.
  - One-click **Sign In in Terminal** spawns each CLI's official interactive login flow (`claude auth login`, `codex login`, `opencode auth login`, `gemini`, `gh auth login`, `cursor-agent login`, etc.) and auto-refreshes auth status upon completion.
  - Per-harness **API Key**, **Custom Base URL / Gateway** (`ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`, etc.), and **Extra Environment Variables** stored locally in SQLite and injected strictly into spawned PTY processes.
- **Real 3-OS Native PTYs (`portable-pty`) & Draggable Split Workspace:**
  - Native ConPTY on Windows (`pwsh`, `powershell`, Git Bash, `cmd`, plus optional `wsl.exe` profiles) and `openpty` login shells on macOS/Linux, streamed over Tauri v2 `ipc::Channel`.
  - Freely draggable resize handles for both sidebars and every vertical/horizontal split pane (double-click to reset), drag-and-drop tab reordering, middle-click tab close, and responsive viewport clamping down to half-screen (`720×500`).
- **Attention-First Agent Rail & Native OS Notifications:**
  - Real-time `working`, `needs_attention`, `done`, `failed`, `idle`, and `hibernated` indicators with latest-words previews and native OS notifications when a background agent needs approval.
- **Git Worktree Isolation & Read-Only Diff Surface:**
  - Safe worktree creation (never deletes existing directories on error), `.worktreeinclude` copying with path-traversal protection, `notify` FS watching, unified diff inspection, quick commit, read-only `git merge-tree --write-tree` conflict dry-run, and `Cmd/Ctrl+Click` external editor jump (VS Code, Cursor, Zed, custom).
- **Real Local Usage & Cost Accounting:**
  - Incremental parsers for local Claude Code, Codex, and OpenCode logs mapped to an updatable `pricing.json` catalog — **zero mock data, zero telemetry**.
- **Crash-Safe Lazy Session Restore:**
  - WAL SQLite journal restores panes in a dormant `hibernated` state (one click or `Enter` to resume) with an automatic crash-loop safe-mode guard.

> **Legacy v1 (Nuxt):** The original Claude-only Nuxt control plane is preserved at git tag `archive/nuxt-v1`.

---

## Keyboard Shortcuts (Windows / Linux / macOS)

| Action | Windows / Linux | macOS |
|---|---|---|
| Command Palette | `Ctrl + K` | `⌘ + K` |
| Launch CLI Harness Tab | `Ctrl + T` | `⌘ + T` |
| Split Pane Right (Vertical) | `Ctrl + D` | `⌘ + D` |
| Split Pane Down (Horizontal) | `Ctrl + Shift + D` | `⌘ + ⇧ + D` |
| Close Active Unpinned Tab | `Ctrl + W` (or Middle-Click) | `⌘ + W` (or Middle-Click) |
| Jump to Next Pane Needing Attention | `Ctrl + Shift + A` | `⌘ + ⇧ + A` |
| Toggle Left Workspaces Sidebar | `Ctrl + B` | `⌘ + B` |
| Toggle Right Git Changes Drawer | `Ctrl + Shift + B` | `⌘ + ⇧ + B` |
| Toggle Usage & Cost Dashboard | `Ctrl + Shift + U` | `⌘ + ⇧ + U` |
| Open Settings & Auth | `Ctrl + ,` | `⌘ + ,` |
| Open File Link in External Editor | `Ctrl + Click` | `⌘ + Click` |

---

## Development

### Prerequisites
- **Rust** (`>=1.80`, `cargo`, `clippy`)
- **Bun** (`>=1.1`) or Node.js `>=20`
- **Git** (`>=2.38` for `git merge-tree --write-tree`)
- **Linux only:** `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf`

### Commands

```bash
# Install frontend dependencies
bun install

# Run full desktop app in dev mode
bun run tauri dev

# Build native OS installer / bundle
bun run tauri build

# Run all checks & tests
bun run typecheck
bun run test
bun run build
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## License

MIT — see [LICENSE](./LICENSE).
