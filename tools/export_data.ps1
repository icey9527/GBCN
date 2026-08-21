# ============================================================
# Convert the translation glossary (terms-*.json export) into
# the slim format used by the site: data/glossary.json
#   [{ "term": <ja>, "translation": <zh>, "note": <category> }]
# Usage: powershell -File tools\export_data.ps1
# ============================================================
param(
    [string]$TermsFile = ""
)
$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot "..\data\glossary.json"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

# 默认自动找 data\ 下最新的 terms-*.json；找不到再看 Downloads
if (-not $TermsFile) {
    $dataDir = Split-Path $dest
    $cand = Get-ChildItem $dataDir -Filter 'terms-*.json' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($cand) { $TermsFile = $cand.FullName }
    else { $TermsFile = 'C:\Users\Administrator\Downloads\terms-20374.json' }
}
Write-Output ("source: " + $TermsFile)
$t = Get-Content $TermsFile -Raw -Encoding UTF8 | ConvertFrom-Json
$out = $t | Sort-Object term | ForEach-Object {
    [pscustomobject]@{
        term       = $_.term
        translation = $_.translation
        note       = $_.note
    }
}
$out | ConvertTo-Json -Depth 3 | Out-File $dest -Encoding utf8
Write-Output ("glossary.json written: " + $out.Count + " terms -> " + $dest)
