---
description: "Bootstrap and launch local COGMINT dashboard"
allowed-tools: ["Bash"]
---

Run the COGMINT bootstrap launcher. It will:
1) Detect OS and architecture
2) Download/install or update COGMINT from GitHub Releases if needed
3) Start COGMINT on a free localhost port
4) Return the local URL for the user

Execute:

```bash
cogmint --bootstrap --open
```

If command is missing, install launcher based on your OS:

```bash
# Windows
pwsh -NoProfile -ExecutionPolicy Bypass -File "$PWD/scripts/distribution/install-cogmint.ps1"

# macOS / Linux
bash "$PWD/scripts/distribution/install-cogmint.sh"
```

Then re-run:

```bash
cogmint --bootstrap --open
```
