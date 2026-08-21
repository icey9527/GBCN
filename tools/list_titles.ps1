# List all page titles (ASCII-only script)
$m = Get-Content (Join-Path $PSScriptRoot "..\wiki_data\manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$m | ForEach-Object { $_.title } | Sort-Object
