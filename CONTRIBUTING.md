# Contributing to COGMINT

Thanks for helping improve COGMINT.

COGMINT is a dark-first control plane for Claude Code orchestration. We keep contributions practical, reviewable, and production-focused.

---

## Development Setup

```bash
git clone https://github.com/ThanhNguyxnOrg/cogmint.git
cd cogmint
bun install
bun run dev
```

Then open `http://localhost:3000`.

---

## Local Validation

Before opening a PR, run:

```bash
bun run typecheck
bun run build
```

If your change touches critical UX paths, include screenshots in the PR.

---

## Contribution Rules

1. Keep PRs focused (one problem per PR when possible)
2. Preserve type-safety (no `as any`, no ts-ignore suppressions)
3. Follow existing composition patterns (`app/composables`, Nuxt page structure)
4. Keep UI changes coherent with the dark-first design direction
5. Update docs when behavior or UX changes

---

## Branch + Commit Style

- Branch examples:
  - `feat/i18n-foundation`
  - `feat/branding-refresh`
  - `fix/workflow-execution`
- Commit message examples:
  - `feat: add locale persistence in settings`
  - `refactor: refresh shell token palette`
  - `docs: rewrite README for cogmint branding`

---

## Pull Request Checklist

- [ ] Feature/fix implemented and scoped correctly
- [ ] Typecheck passes
- [ ] Build passes
- [ ] README/CONTRIBUTING updated if needed
- [ ] Screenshots added for UI changes
- [ ] PR description explains motivation + impact

---

## Need Help?

Open an issue with:

- Current behavior
- Expected behavior
- Repro steps
- Environment notes (OS, Bun/Node version)

We review with a practical engineering lens and appreciate concise, high-signal reports.
