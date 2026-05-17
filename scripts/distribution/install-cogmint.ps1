param()

$ErrorActionPreference = 'Stop'

$binDir = Join-Path $HOME ".cogmint\bin"
if (-not (Test-Path $binDir)) {
  New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

$wrapper = Join-Path $binDir "cogmint.cmd"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$entry = Join-Path $projectRoot "bin\start.mjs"

@"
@echo off
node "$entry" %*
"@ | Set-Content -Path $wrapper -Encoding ASCII

Write-Host "Installed COGMINT wrapper at: $wrapper"
Write-Host "If needed, add to PATH: $binDir"
Write-Host "Then run: cogmint --bootstrap --open"
