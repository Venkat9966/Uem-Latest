<#
Build deploy package for UEM Labs
Usage (Windows PowerShell):
  cd c:\xampp\htdocs\uemlabs
  powershell -ExecutionPolicy Bypass -File .\scripts\build_deploy.ps1 -OutPath ..\uemlabs-deploy.zip

This script packages the app files needed for deployment, excluding local logs and .env.
#>
param(
    [string]$OutPath = "..\uemlabs-deploy.zip"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Packaging deploy archive to: $OutPath"

$include = @(
    "index.html",
    "tutor-dashboard.html",
    "app.js",
    "dist\*",
    "api\*",
    "styles.css",
    "dashboard.css",
    "README-DEPLOY.md",
    ".env.example",
    "database\schema.sql"
)

$tmp = Join-Path $env:TEMP ([Guid]::NewGuid().ToString())
New-Item -Path $tmp -ItemType Directory | Out-Null

foreach ($pattern in $include) {
    $paths = Get-ChildItem -Path (Join-Path $root $pattern) -Recurse -ErrorAction SilentlyContinue
    foreach ($p in $paths) {
        $dest = $p.FullName.Substring($root.Length).TrimStart('\')
        $target = Join-Path $tmp $dest
        New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
        Copy-Item -Path $p.FullName -Destination $target -Force
    }
}

if (Test-Path (Join-Path $tmp '.env')) { Remove-Item (Join-Path $tmp '.env') -Force }

Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath (Join-Path $root $OutPath) -Force
Remove-Item -Recurse -Force $tmp
Write-Host "Created $OutPath"
