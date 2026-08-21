# ============================================================
# Convert the translation glossary (terms-*.json export) into
# the slim format used by the site: data/glossary.json
#   [{ "term": <ja>, "translation": <zh>, "note": <category> }]
# Usage: powershell -File tools\export_data.ps1
# ============================================================
param(
    [string]$TermsFile = "C:\Users\Administrator\Downloads\terms-20374.json"
)
$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot "..\data\glossary.json"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

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
