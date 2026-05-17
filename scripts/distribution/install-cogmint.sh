#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENTRY="$PROJECT_ROOT/bin/start.mjs"
BIN_DIR="${HOME}/.cogmint/bin"
WRAPPER="$BIN_DIR/cogmint"

if [[ ! -f "$ENTRY" ]]; then
  echo "Launcher entry not found: $ENTRY" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"

cat > "$WRAPPER" <<EOF
#!/usr/bin/env bash
node "$ENTRY" "\$@"
EOF

chmod +x "$WRAPPER"

echo "Installed COGMINT wrapper at: $WRAPPER"
echo "If needed, add to PATH: export PATH=\"$BIN_DIR:\$PATH\""
echo "Then run: cogmint --bootstrap --open"
