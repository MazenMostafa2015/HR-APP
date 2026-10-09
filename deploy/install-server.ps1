[CmdletBinding()]
param(
  [string]$InstallDir = 'C:\ProgramData\ELMS',
  [int]$Port = 3000,
  [switch]$SkipSeed
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Require-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name was not found. $Hint" }
}

Require-Command node 'Install Node.js 22 LTS on the server.'
Require-Command pnpm 'Install pnpm 10.18.0 with Corepack: corepack enable; corepack prepare pnpm@10.18.0 --activate.'
Require-Command mysql 'Install MySQL Server 8 and add mysql.exe to PATH.'

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'storage') | Out-Null

Write-Host 'Copying application files…'
C:\Windows\System32\robocopy.exe $RepoRoot $InstallDir /E /XD node_modules dist release .git /XF .env .env.* | Out-Null
Set-Location $InstallDir

if (-not (Test-Path '.env')) {
  Copy-Item '.env.internal.example' '.env'
  (Get-Content '.env') -replace '^PORT=.*', "PORT=$Port" -replace '^STORAGE_PATH=.*', "STORAGE_PATH=$InstallDir\storage" | Set-Content '.env'
  Write-Warning "Created $InstallDir\.env. Edit DATABASE_URL and OAuth/SMTP values before continuing."
  Write-Host 'Re-run this script after editing .env.'
  exit 2
}

pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
if (-not $SkipSeed) { pnpm db:seed }

$rule = "ELMS API TCP $Port"
if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain,Private | Out-Null
}

Write-Host "Server files installed at $InstallDir"
Write-Host "Verify locally: curl http://127.0.0.1:$Port/api/health"
Write-Host 'Register the app as a Windows service using NSSM or a company-approved service manager:'
Write-Host "  Application: node"
Write-Host "  Arguments: $InstallDir\dist\index.js"
Write-Host "  Startup directory: $InstallDir"
Write-Host 'Configure the service environment with NODE_ENV=production and PORT.'
