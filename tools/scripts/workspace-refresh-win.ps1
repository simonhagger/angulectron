Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

Write-Host 'Refreshing workspace state (Windows)...'

# 1) Stop Nx daemon first.
try {
  pnpm nx daemon --stop | Out-Host
} catch {
  Write-Host 'Nx daemon stop reported an error; continuing with forced cleanup.'
}

# 2) Stop node/electron processes tied to this workspace.
$repoPattern = [Regex]::Escape($repoRoot)
$nodeTargets = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine -match $repoPattern -and
    $_.CommandLine -match 'nx|electron|ng\.js|vite|vitest|wait-on|playwright'
  }

if ($nodeTargets) {
  $targetPids = @($nodeTargets | Select-Object -ExpandProperty ProcessId)
  foreach ($targetPid in $targetPids) {
    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
  }
  Write-Host ("Stopped workspace Node processes: " + ($targetPids -join ', '))
} else {
  Write-Host 'No workspace Node processes found.'
}

$electronTargets = Get-CimInstance Win32_Process -Filter "name = 'electron.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -match $repoPattern }

if ($electronTargets) {
  $electronPids = @($electronTargets | Select-Object -ExpandProperty ProcessId)
  foreach ($electronPid in $electronPids) {
    Stop-Process -Id $electronPid -Force -ErrorAction SilentlyContinue
  }
  Write-Host ("Stopped workspace Electron processes: " + ($electronPids -join ', '))
}

Start-Sleep -Milliseconds 400

# 3) Remove locked Nx workspace-data with retries.
$workspaceData = Join-Path $repoRoot '.nx\workspace-data'
if (Test-Path $workspaceData) {
  $removed = $false
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      Remove-Item -Recurse -Force $workspaceData -ErrorAction Stop
      $removed = $true
      Write-Host 'Removed .nx/workspace-data'
      break
    } catch {
      Write-Host "Attempt $attempt/5 to remove .nx/workspace-data failed; retrying..."
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $removed -and (Test-Path $workspaceData)) {
    throw 'Unable to remove .nx/workspace-data after retries. Close VS Code terminals and retry.'
  }
}

# 4) Reset Nx and rebuild key targets.
pnpm nx reset | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm nx run renderer:build --skip-nx-cache | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm nx run-many -t build --projects=desktop-preload,desktop-main --skip-nx-cache | Out-Host
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Workspace refresh complete.'
Write-Host 'Next: pnpm desktop:dev:win'
