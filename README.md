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

COGMINT v2 is a **local-first, zero-telemetry desktop workstation** built on **Tauri v2 (Rust) + React 19 + Tailwind CSS v4** for running multiple CLI coding agents side-by-side in isolated Git worktrees.

- **12 Built-In CLI Harnesses + Custom CLIs:** Claude Code (`claude`), Codex (`codex`), OpenCode (`opencode`), Gemini CLI (`gemini`), Copilot CLI (`copilot`), Antigravity (`agy`), Amp (`amp`), Kimi (`kimi`), Kiro (`kiro-cli`), Grok (`grok`), Mistral Vibe (`vibe`), Droid (`droid`), plus any user-defined CLI command.
- **Attention-First Agent Rail:** Real-time `working`, `needs_attention`, `done`, `failed`, `idle`, and `hibernated` indicators with latest-words previews and native OS notifications.
- **Real 3-OS PTYs (`portable-pty`):** Native ConPTY on Windows (`pwsh`, `powershell`, Git Bash, `cmd`, plus optional `wsl.exe` profiles) and `openpty` login shells on macOS/Linux, streamed via Tauri v2 `ipc::Channel` into WebGL `xterm.js` split panes.
- **Git Worktree Isolation & Read-Only Diff Surface:** Safe worktree creation (never auto-deletes existing directories on error), `.worktreeinclude` copying with path-traversal protection, `notify` FS watching, unified diff inspection, quick commit, read-only `git merge-tree` conflict dry-run, and `Cmd/Ctrl+Click` external editor jump (VS Code, Cursor, Zed, custom).
- **Real Local Usage & Cost Accounting:** Incremental parsers for local Claude Code, Codex, and OpenCode logs mapped to an updatable `pricing.json` catalog — **zero mock data, zero telemetry, zero OAuth scraping**.
- **Crash-Safe Lazy Session Restore:** WAL SQLite journal restores panes in a dormant `hibernated` state (one click or `Enter` to resume) with an automatic crash-loop safe-mode guard.

> **Legacy v1 (Nuxt):** The original Claude-only Nuxt control plane is preserved at git tag `archive/nuxt-v1`.

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
