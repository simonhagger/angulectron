Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

# Ensure Electron runs in GUI mode.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

$rendererUrl = "http://localhost:4200"
$rendererPort = 4200
$listener = Get-NetTCPConnection -LocalPort $rendererPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($listener) {
  Write-Host "Renderer already listening on port $rendererPort. Reusing existing dev server."
  pnpm run build-desktop
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $env:NODE_ENV = "development"
  $env:RENDERER_DEV_URL = $rendererUrl
  pnpm exec electron dist/apps/desktop-main/main.js
  exit $LASTEXITCODE
}

pnpm run build-desktop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$rendererProcess = Start-Process -FilePath "pnpm.cmd" -ArgumentList "renderer:serve" -WorkingDirectory $repoRoot -PassThru

try {
  pnpm wait-on $rendererUrl
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $env:NODE_ENV = "development"
  $env:RENDERER_DEV_URL = $rendererUrl
  pnpm exec electron dist/apps/desktop-main/main.js
  exit $LASTEXITCODE
}
finally {
  if ($rendererProcess -and -not $rendererProcess.HasExited) {
    Stop-Process -Id $rendererProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
