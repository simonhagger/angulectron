Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

# Ensure Electron runs in GUI mode.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
# The dev URL is hard-coded in apps/desktop-main/src/runtime-config.ts.
# Any ambient RENDERER_DEV_URL must not influence this flow.
Remove-Item Env:RENDERER_DEV_URL -ErrorAction SilentlyContinue

$rendererPort = 4210
$rendererUrl = "http://localhost:$rendererPort"
$expectedTitle = "Electron Angular Foundation"

function Test-RendererIdentity {
  try {
    $response = Invoke-WebRequest -Uri $rendererUrl -UseBasicParsing -TimeoutSec 5
    return $response.Content -match [regex]::Escape("<title>$expectedTitle</title>")
  }
  catch {
    return $false
  }
}

pnpm run build-desktop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$listener = Get-NetTCPConnection -LocalPort $rendererPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($listener) {
  if (-not (Test-RendererIdentity)) {
    Write-Error ("Port {0} is occupied by an unrelated server. Stop that process or free the port; refusing to load it into the desktop shell." -f $rendererPort)
    exit 1
  }
  Write-Host "Verified Angulectron renderer already listening on port $rendererPort. Reusing it."

  $env:NODE_ENV = "development"
  pnpm exec electron dist/apps/desktop-main/main.js
  exit $LASTEXITCODE
}

$rendererProcess = Start-Process -FilePath "pnpm.cmd" -ArgumentList "run", "renderer:serve", "--", "--port", "$rendererPort" -WorkingDirectory $repoRoot -PassThru

try {
  pnpm wait-on $rendererUrl
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if (-not (Test-RendererIdentity)) {
    Write-Error ("Server on port {0} does not report the Angulectron renderer title. Aborting launch." -f $rendererPort)
    exit 1
  }

  $env:NODE_ENV = "development"
  pnpm exec electron dist/apps/desktop-main/main.js
  exit $LASTEXITCODE
}
finally {
  if ($rendererProcess -and -not $rendererProcess.HasExited) {
    Stop-Process -Id $rendererProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
