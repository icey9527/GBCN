# ============================================================
# Scan wiki_data/pages/*.json and emit wiki_data/index.json:
#   [{ "title": ..., "categories": [...] }]
# Run after download_wiki.ps1 (and again if pages updated).
# Usage: powershell -File tools\build_index.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
$OutDir = Join-Path $PSScriptRoot "..\wiki_data"
$PagesDir = Join-Path $OutDir 'pages'

$list = New-Object System.Collections.Generic.List[object]
Get-ChildItem $PagesDir -Filter '*.json' | Sort-Object Name | ForEach-Object {
    $p = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    $list.Add([pscustomobject]@{
        title      = $p.title
        categories = @($p.categories)
    })
}

$dest = Join-Path $OutDir 'index.json'
$list | ConvertTo-Json -Depth 4 | Out-File $dest -Encoding utf8
Write-Output ("index.json written: " + $list.Count + " pages -> " + $dest)
