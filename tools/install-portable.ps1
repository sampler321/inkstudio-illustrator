# InkStudio for a PortableApps-style Illustrator (C:\Illustrator\IllustratorPortable.exe). Run with Illustrator closed:
#   powershell -ExecutionPolicy Bypass -File install-portable.ps1 [-Root C:\Illustrator]
# The launcher swaps Data\Roaming\...\Adobe Illustrator 30 Settings and the CSXS.12 registry key in and out on every
# run, so brushes, workspace and PlayerDebugMode go into its Data folder; the extension goes to %APPDATA%\Adobe\CEP.
param([string]$Root = 'C:\Illustrator')
$ErrorActionPreference = 'Stop'
if (Get-Process Illustrator, IllustratorPortable -ErrorAction SilentlyContinue) { throw 'Close Illustrator first.' }
$pkg = $PSScriptRoot
$e = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
New-Item -ItemType Directory -Force $e | Out-Null
Remove-Item -Recurse -Force (Join-Path $e 'com.inkdraw.studio') -ErrorAction SilentlyContinue
Copy-Item -Recurse (Join-Path $pkg 'com.inkdraw.studio') $e
foreach ($v in 11, 12) { New-Item -Force "HKCU:\Software\Adobe\CSXS.$v" -ErrorAction SilentlyContinue | Out-Null; Set-ItemProperty "HKCU:\Software\Adobe\CSXS.$v" PlayerDebugMode '1' }
$reg = Join-Path $Root 'Data\settings\CSXS.12.reg'
if (Test-Path $reg) {
  $t = Get-Content $reg -Raw -Encoding Unicode
  if ($t -notmatch 'PlayerDebugMode') { Copy-Item $reg "$reg.bak" -Force; Set-Content $reg ($t.TrimEnd() + "`r`n""PlayerDebugMode""=""1""`r`n") -Encoding Unicode -NoNewline }
} else {
  New-Item -ItemType Directory -Force (Split-Path $reg) | Out-Null
  Set-Content $reg "Windows Registry Editor Version 5.00`r`n`r`n[HKEY_CURRENT_USER\SOFTWARE\Adobe\CSXS.12]`r`n""PlayerDebugMode""=""1""`r`n" -Encoding Unicode
}
Get-ChildItem (Join-Path $Root 'Data\Roaming\Adobe\Adobe Illustrator 30 Settings') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  $x = Join-Path $_.FullName 'x64'; if (-not (Test-Path $x)) { return }
  # localized folder names (Polish: Pędzle, Obszary robocze); match by pattern to avoid encoding trouble
  $b = Get-ChildItem $x -Directory | Where-Object { $_.Name -in 'Brushes' -or $_.Name -like 'P?dzle' } | Select-Object -First 1
  if (-not $b) { $b = New-Item -ItemType Directory (Join-Path $x 'Brushes') }
  Copy-Item -Recurse -Force (Join-Path $pkg 'com.inkdraw.studio\brushes\*') $b.FullName
  $w = Get-ChildItem $x -Directory | Where-Object { $_.Name -in 'Workspaces', 'Obszary robocze' } | Select-Object -First 1
  if (-not $w) { $w = New-Item -ItemType Directory (Join-Path $x 'Workspaces') }
  Copy-Item -Force (Join-Path $pkg 'InkStudio.workspace') (Join-Path $w.FullName 'InkStudio')
  Write-Host "settings: $($_.Name) -> brushes and workspace installed"
}
Write-Host 'InkStudio installed. Start Illustrator with IllustratorPortable.exe, open a document, Window > Workspace > InkStudio.'
