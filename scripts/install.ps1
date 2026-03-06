#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$RepoUrl = "https://github.com/anomalyco/kronoscode.git",
  [string]$Branch = "dev",
  [string]$InstallDir = "$HOME\.kronoscode\src\kronoscoder"
)

function Ensure-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

Write-Host "[bootstrap] Installing KronosCode from $RepoUrl ($Branch)"
Ensure-Command git
Ensure-Command bun
Ensure-Command node

$parent = Split-Path -Parent $InstallDir
New-Item -ItemType Directory -Path $parent -Force | Out-Null

if (Test-Path (Join-Path $InstallDir ".git")) {
  Write-Host "[bootstrap] Updating existing checkout at $InstallDir"
  git -C $InstallDir fetch origin $Branch --depth 1
  git -C $InstallDir checkout $Branch
  git -C $InstallDir pull --ff-only origin $Branch
} else {
  Write-Host "[bootstrap] Cloning repository to $InstallDir"
  git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
}

Push-Location $InstallDir
try {
  bun install --ignore-scripts

  $binSource = Join-Path $InstallDir "packages\kronoscode\bin\kronoscode"
  $localBin = Join-Path $HOME ".local\bin"
  New-Item -ItemType Directory -Path $localBin -Force | Out-Null

  $shimPath = Join-Path $localBin "kronoscode.cmd"
  $shim = "@echo off`r`nnode `"$binSource`" %*`r`n"
  [System.IO.File]::WriteAllText($shimPath, $shim, [System.Text.Encoding]::ASCII)

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ([string]::IsNullOrWhiteSpace($userPath)) {
    [Environment]::SetEnvironmentVariable("Path", $localBin, "User")
  } elseif (-not ($userPath.Split(';') -contains $localBin)) {
    [Environment]::SetEnvironmentVariable("Path", "$localBin;$userPath", "User")
  }

  try {
    node scripts/apply-kronos-config.mjs | Out-Host
  } catch {
    Write-Warning "apply-kronos-config failed: $($_.Exception.Message)"
  }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "[bootstrap] Installed."
Write-Host "[bootstrap] Start everything:"
Write-Host "  node scripts/restart-all.mjs --with-browseros --with-desktop --json"
Write-Host "[bootstrap] If kronoscode is not found yet, restart your terminal."
