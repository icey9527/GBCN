# Diff old vs new glossary export (ASCII-only: paths derived at runtime, no CJK literals)
$ErrorActionPreference = 'Stop'
$oldF = 'C:\Users\Administrator\Downloads\terms-20374.json'
$dataDir = Join-Path $PSScriptRoot "..\data"
$newF = (Get-ChildItem $dataDir -Filter 'terms-*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
Write-Output ("new file: " + $newF)

$old = Get-Content $oldF -Raw -Encoding UTF8 | ConvertFrom-Json
$new = Get-Content $newF -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("old count: " + $old.Count + "  new count: " + $new.Count)

$oldMap = @{}
foreach ($t in $old) { $oldMap[$t.term] = $t }
$newMap = @{}
foreach ($t in $new) { $newMap[$t.term] = $t }

Write-Output "--- changed translations/notes:"
foreach ($k in ($newMap.Keys | Sort-Object)) {
    if (-not $oldMap.ContainsKey($k)) { continue }
    $a = $oldMap[$k]; $b = $newMap[$k]
    if ($a.translation -ne $b.translation -or $a.note -ne $b.note) {
        Write-Output ($k + " : [" + $a.translation + "|" + $a.note + "] -> [" + $b.translation + "|" + $b.note + "]")
    }
}
Write-Output "--- added in new:"
foreach ($k in ($newMap.Keys | Sort-Object)) {
    if (-not $oldMap.ContainsKey($k)) {
        $b = $newMap[$k]
        Write-Output ($k + " = " + $b.translation + "  [" + $b.note + "]")
    }
}
Write-Output "--- removed in new:"
foreach ($k in ($oldMap.Keys | Sort-Object)) {
    if (-not $newMap.ContainsKey($k)) { Write-Output $k }
}
