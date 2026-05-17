# Security Policy

## Supported Versions

COGMINT is under active development. Only the latest minor release on `main`
receives security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

Please **do not** open a public issue for security reports.

Use one of the following private channels:

1. Open a [private security advisory](https://github.com/ThanhNguyxnOrg/cogmint/security/advisories/new)
   on this repository.
2. Or, contact the maintainer directly through their GitHub profile:
   [@RealThanhNguyxn](https://github.com/RealThanhNguyxn).

When reporting, please include:

- A clear description of the issue
- Steps to reproduce or a proof-of-concept
- Affected version, OS, and runtime details
- Any relevant logs or screenshots (with secrets redacted)

You will receive an acknowledgement within a reasonable timeframe. We will
work with you to confirm the issue, prepare a fix, and coordinate disclosure.

## Scope

In scope:

- The COGMINT application code in this repository
- Distribution scripts under `scripts/distribution/`
- Plugin entry under `.claude-plugin/`

Out of scope:

- Third-party dependencies (please report upstream)
- The Claude Code CLI itself (report to Anthropic)
- Issues requiring an already-compromised local machine

## Safe Harbor

Good-faith research conducted under this policy is welcome. We will not pursue
or support legal action against researchers who follow this policy.
