[CmdletBinding()]
param(
  [switch]$SkipGit,
  [switch]$SkipNode
)

$ErrorActionPreference = 'Stop'
$NodeVersion = '22.23.3'
$NodeUrl = "https://nodejs.org/dist/latest-v22.x/node-v$NodeVersion-x64.msi"
$NodeSha256 = '1c0efc8449987e7da5d184786a0a96da83ffa11d334421201e5c09b93017cb8d'
$GitVersion = '2.56.0.2'
$GitUrl = "https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.2/Git-$GitVersion-64-bit.exe"
$GitSha256 = '52188f917b378f00c70ec136bcf090005f30d44fbc4eba0bce759cc6592d60f6'
$PnpmVersion = '10.18.0'
$WorkDir = Join-Path $env:TEMP "ELMS-Server-Prerequisites-$([guid]::NewGuid().ToString('N'))"

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Require-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this installer as Administrator.'
  }
}
function Download-Verified([string]$Url, [string]$Path, [string]$ExpectedSha256) {
  Write-Host "Downloading $Url"
  Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
  $actual = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "Checksum verification failed for $Path. Expected $ExpectedSha256 but received $actual."
  }
}
function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}
function Get-Version([string]$Command, [string]$Arguments = '--version') {
  try { return (& $Command $Arguments 2>$null | Select-Object -First 1).ToString().Trim() } catch { return $null }
}

try {
  Require-Administrator
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  Write-Host 'ELMS Server Prerequisites Installer' -ForegroundColor Green
  Write-Host "This installer prepares a Windows host for the ELMS backend."

  if (-not $SkipNode) {
    Write-Step "Installing Node.js $NodeVersion LTS (includes npm)"
    $nodeMsi = Join-Path $WorkDir "node-v$NodeVersion-x64.msi"
    Download-Verified $NodeUrl $nodeMsi $NodeSha256
    $nodeProcess = Start-Process msiexec.exe -ArgumentList @('/i', $nodeMsi, '/qn', '/norestart') -Wait -PassThru
    if ($nodeProcess.ExitCode -notin @(0, 3010)) { throw "Node.js MSI failed with exit code $($nodeProcess.ExitCode)." }
    Refresh-Path
  }

  if (-not $SkipGit) {
    Write-Step "Installing Git for Windows $GitVersion"
    $gitExe = Join-Path $WorkDir "Git-$GitVersion-64-bit.exe"
    Download-Verified $GitUrl $gitExe $GitSha256
    $gitProcess = Start-Process $gitExe -ArgumentList @('/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-', '/CLOSEAPPLICATIONS') -Wait -PassThru
    if ($gitProcess.ExitCode -ne 0) { throw "Git for Windows installer failed with exit code $($gitProcess.ExitCode)." }
    Refresh-Path
  }

  Write-Step "Activating pnpm $PnpmVersion through Corepack"
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found after installation.' }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found after Node.js installation.' }
  & corepack enable
  & corepack prepare "pnpm@$PnpmVersion" --activate
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Corepack activation failed; installing the pinned pnpm version through npm.'
    & npm install --global "pnpm@$PnpmVersion"
  }
  Refresh-Path

  Write-Step 'Verifying installed tools'
  $node = Get-Version 'node'
  $npm = Get-Version 'npm'
  $pnpm = Get-Version 'pnpm'
  $git = if ($SkipGit) { 'skipped' } else { Get-Version 'git' }
  if (-not $node -or -not $npm -or -not $pnpm) { throw 'Node.js, npm, or pnpm verification failed.' }
  if (-not $SkipGit -and -not $git) { throw 'Git verification failed.' }
  Write-Host "Node.js: $node"
  Write-Host "npm:     $npm"
  Write-Host "pnpm:    $pnpm"
  Write-Host "Git:     $git"
  Write-Host "`nServer prerequisites are ready. Continue with MySQL and the ELMS server installation guide." -ForegroundColor Green
  exit 0
} catch {
  Write-Error $_
  exit 1
} finally {
  if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force -ErrorAction SilentlyContinue }
}
