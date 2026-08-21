# Dump first part of page text for identity check (ASCII-only script)
$ErrorActionPreference = 'Stop'
$PagesDir = Join-Path $PSScriptRoot "..\wiki_data\pages"
$m = Get-Content (Join-Path $PSScriptRoot "..\wiki_data\manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json

foreach ($want in @('May', 'Kasumi', 'Luna', 'Mei', 'Mei Mei', 'Lovlila Ani')) {
    $e = $m | Where-Object { $_.title -eq $want } | Select-Object -First 1
    if (-not $e) { Write-Output ("=== " + $want + " : NOT FOUND"); continue }
    $p = Get-Content (Join-Path $PagesDir $e.file) -Raw -Encoding UTF8 | ConvertFrom-Json
    $txt = $p.html -replace '<[^>]+>', ' ' -replace '\s+', ' '
    Write-Output ("=== " + $want + " [" + ($p.categories -join ', ') + "]")
    Write-Output ($txt.Substring(0, [Math]::Min(400, $txt.Length)))
    Write-Output ""
}
