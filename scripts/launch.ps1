#!/usr/bin/env pwsh
# Personal Assistant AI - Launch Script (Windows PowerShell)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Join-Path $ProjectRoot ".."
Set-Location $ProjectRoot

Write-Host "🚀 Personal Assistant AI - Starting up..." -ForegroundColor Green

# Check if mathcore is installed
if (-not (Get-Command "mathcore-mcp" -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing mathcore..." -ForegroundColor Yellow
    pip install -e ..\mathcore
}

# Check if node_modules exist
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
    pnpm install
}

# Build if needed
if (-not (Test-Path "packages\assistant-core\dist")) {
    Write-Host "🔨 Building packages..." -ForegroundColor Yellow
    pnpm run build
}

# Start the assistant
Write-Host "✨ Starting Personal Assistant..." -ForegroundColor Green
pnpm run dev