# SPDX-License-Identifier: LicenseRef-Proprietary
# Copyright (c) 2026 blockchain-voting-system.
# Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.

param(
  [switch]$Docker,
  [switch]$SkipInstall,
  [switch]$RunMigrations,
  [switch]$Start
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "[install] $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param(
    [string]$Name,
    [string]$Hint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name. $Hint"
  }
}

function Ensure-EnvFile {
  param(
    [string]$ExamplePath,
    [string]$TargetPath
  )

  if (-not (Test-Path $TargetPath)) {
    Copy-Item $ExamplePath $TargetPath
    Write-Step "Created $TargetPath from template."
  } else {
    Write-Step "Using existing $TargetPath"
  }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'

Write-Step "Repository root: $RepoRoot"

Assert-Command -Name 'node' -Hint 'Install Node.js 20+.'
Assert-Command -Name 'npm' -Hint 'npm is required for dependency installation.'

if ($Docker) {
  Assert-Command -Name 'docker' -Hint 'Install Docker Desktop to use container mode.'
  Write-Step 'Starting Docker stack...'
  Push-Location $RepoRoot
  try {
    docker compose up --build -d
  } finally {
    Pop-Location
  }

  Write-Host ''
  Write-Host 'Docker services started.' -ForegroundColor Green
  Write-Host 'Frontend: http://localhost:5173'
  Write-Host 'Backend:  http://localhost:3000'
  exit 0
}

Write-Step 'Ensuring environment files exist...'
Ensure-EnvFile -ExamplePath (Join-Path $BackendDir '.env.example') -TargetPath (Join-Path $BackendDir '.env')
Ensure-EnvFile -ExamplePath (Join-Path $FrontendDir '.env.example') -TargetPath (Join-Path $FrontendDir '.env')

if (-not $SkipInstall) {
  Write-Step 'Installing backend dependencies...'
  Push-Location $BackendDir
  try {
    if (Test-Path 'package-lock.json') { npm ci } else { npm install }
  } finally {
    Pop-Location
  }

  Write-Step 'Installing frontend dependencies...'
  Push-Location $FrontendDir
  try {
    if (Test-Path 'package-lock.json') { npm ci } else { npm install }
  } finally {
    Pop-Location
  }
} else {
  Write-Step 'Skipping npm install by request.'
}

if ($RunMigrations) {
  Write-Step 'Running Prisma generate/migration commands...'
  Push-Location $BackendDir
  try {
    npx prisma generate
    npx prisma migrate deploy
    npx prisma db push
  } finally {
    Pop-Location
  }
}

if ($Start) {
  Write-Step 'Starting backend and frontend dev servers in new terminal windows...'
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$BackendDir'; npm run dev"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$FrontendDir'; npm run dev"

  Write-Host ''
  Write-Host 'Development servers launching in separate terminals.' -ForegroundColor Green
  Write-Host 'Frontend: http://localhost:5173'
  Write-Host 'Backend API: http://localhost:3000'
} else {
  Write-Host ''
  Write-Host 'Install completed.' -ForegroundColor Green
  Write-Host 'Next:'
  Write-Host "  1) cd $BackendDir; npm run dev"
  Write-Host "  2) cd $FrontendDir; npm run dev"
}
