# COGMINT Future Plan

This plan captures validated future directions from community feedback. These are not immediate implementation tasks.

## Status
- Horizon: Future backlog (post-polish)
- Priority policy: Only pick items with clear user value and low architecture risk first.

---

## 1) Keep CLI-first users supported (No-UI mode remains first-class)

### Feedback signal
> "Mình xài thuần cli thấy k có gì bất tiện... UI thấy k cần thiết lắm."

### Interpretation
Some users do not need a full dashboard. They need faster access to existing Claude CLI flows and shortcuts.

### Future direction
- Position COGMINT as optional control plane, not replacement for CLI.
- Add explicit "CLI-first" mode in product messaging and onboarding.
- Ensure all core operations have command-level equivalents.

### Candidate deliverables
- Docs section: "COGMINT for CLI-first workflows"
- Minimal mode toggle in UI (reduced chrome, command launcher focus)
- Shortcut profile presets mirroring splash commands/skills usage

---

## 2) Raycast extension bridge

### Feedback signal
> "Build đống này qua raycast ext thì mình ủng hộ"

### Interpretation
A lightweight launcher integration can provide high daily utility without opening full UI.

### Future direction
- Build COGMINT Raycast extension to trigger key local actions.

### Candidate command set
- Open agent by slug
- Run saved workflow
- Search commands/skills
- Open current session history
- Toggle plugin/skill state

### Technical notes
- Prefer local API bridge to existing Nuxt server endpoints.
- Keep secure token/localhost model for Raycast comms.

---

## 3) "Full for CLI users" operational toolkit

### Feedback signal
> "Làm full cho mấy bọn CLI thì ngon"

### Interpretation
Need robust operations around terminal-first development, not just UI editing.

### Future direction
- Expand terminal/session observability and automation primitives.

### Candidate deliverables
- Session templates (agent + working dir + permissions + model)
- One-click replay of prior successful sessions
- Failure triage panel (recent errors, tool failures, file changes)
- Faster switching between standalone CLI and agent-aware CLI

---

## 4) OpenAI-compatible third-party server support

### Feedback signal
> "cấu hình server claude openai compatible từ bên thứ 3 đc k bác"

### Interpretation
Users want routing flexibility beyond first-party Anthropic endpoints.

### Future direction
- Add provider profile abstraction supporting OpenAI-compatible APIs.

### Candidate deliverables
- Provider profiles: Anthropic, OpenAI-compatible generic, custom base URL
- Per-profile model mapping and auth header templates
- Validation ping + capability test before save
- UI warning when provider behavior differs from Claude SDK expectations

### Constraints
- Must keep compatibility with existing Claude SDK path.
- Avoid breaking current `ANTHROPIC_*` env workflows.
- Security: secrets storage and masking rules required before release.

---

## Suggested rollout order
1. CLI-first documentation + mode positioning (low risk, high clarity)
2. CLI operations toolkit improvements (high daily value)
3. Raycast extension MVP (high convenience)
4. OpenAI-compatible provider profiles (higher complexity, needs careful compatibility matrix)

---

## 5) Distribution strategy (professional, minimal middlemen)

### Goal
Ship COGMINT in a production-grade way while avoiding heavy dependency on package middlemen like npm for primary installation.

### Preferred distribution model
- Primary channel: **GitHub Releases** with signed artifacts for all 3 OS
  - Windows: `.zip` + installer script
  - macOS: `.tar.gz` (intel + apple silicon) + installer script
  - Linux: `.tar.gz` + installer script
- Integrity checks: SHA256 checksums + optional signature verification before install
- Npm path remains optional fallback only, not the main path

### Runtime bootstrap flow for `/cogmint`
- `/cogmint` command checks local COGMINT binary availability/version
- If missing/outdated: download latest matching OS artifact from GitHub Release, verify checksum, install to user-local bin path
- Start local server on free port, then return local URL (`http://127.0.0.1:<port>`)

### Operational polish requirements
- Auto-update command (`cogmint update`) with rollback on failed upgrade
- Health-check endpoint before opening browser
- Structured logs for install/start failures by OS
- Fallback path: Docker-based start for users who prefer container runtime

### CI/CD requirements
- Matrix builds for `windows-latest`, `macos-latest`, `ubuntu-latest`
- Publish release assets + checksums on tag
- Smoke-test each artifact in clean runner before publish

---

## Success criteria (future)
- CLI-first users can finish common tasks without full page navigation.
- Raycast users can execute top 5 actions in <5 seconds.
- Provider profile setup succeeds with validation feedback and no silent misconfiguration.
