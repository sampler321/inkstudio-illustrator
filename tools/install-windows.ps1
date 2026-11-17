# Installs InkStudio into Illustrator on Windows (run from this folder, Illustrator closed):
#   powershell -ExecutionPolicy Bypass -File install-windows.ps1
# Copies com.inkdraw.studio to %APPDATA%\Adobe\CEP\extensions and lets Illustrator load unsigned panels
# (PlayerDebugMode=1 for CSXS 11 and 12, per user, in Adobe's own registry key).
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'com.inkdraw.studio'
$dst = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.inkdraw.studio'
if (Get-Process -Name 'Illustrator' -ErrorAction SilentlyContinue) { throw 'Close Illustrator first.' }
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse $src $dst
foreach ($v in 11, 12) {
  $k = "HKCU:\Software\Adobe\CSXS.$v"
  New-Item -Force -Path $k | Out-Null
  Set-ItemProperty -Path $k -Name PlayerDebugMode -Value '1'
}
# the InkStudio workspace (Window > Workspace > InkStudio) for every installed Illustrator version
Get-ChildItem (Join-Path $env:APPDATA 'Adobe') -Directory -Filter 'Adobe Illustrator * Settings' -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ChildItem $_.FullName -Directory } | ForEach-Object {
    $ws = Get-ChildItem $_.FullName -Directory -Filter 'x64' -ErrorAction SilentlyContinue | Select-Object -First 1
    $base = if ($ws) { $ws.FullName } else { $_.FullName }
    # the folder name is localized (Polish: 'Obszary robocze'); use an existing one when present
    $wsDir = Get-ChildItem $base -Directory | Where-Object { $_.Name -in 'Workspaces', 'Obszary robocze', 'Arbeitsbereiche', 'Espaces de travail', 'Werkruimten', 'Áreas de trabajo', 'Aree di lavoro' } | Select-Object -First 1
    $wsDir = if ($wsDir) { $wsDir.FullName } else { Join-Path $base 'Workspaces' }
    New-Item -ItemType Directory -Force -Path $wsDir | Out-Null
    Copy-Item (Join-Path $PSScriptRoot 'InkStudio.workspace') (Join-Path $wsDir 'InkStudio') -Force
  }
Write-Host "InkStudio installed. Start Illustrator, then Window > Workspace > InkStudio."
