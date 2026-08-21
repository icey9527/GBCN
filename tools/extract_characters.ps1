# Extract character-related terms from the glossary (ASCII-safe: no literal CJK in this file)
$ErrorActionPreference = 'Stop'
# "jue se" (character) and fullwidth comma as char codes -> ASCII-only source file
$JUESE   = [string][char]0x89D2 + [char]0x8272
$COMMA   = [char]0xFF0C

$t = Get-Content 'C:\Users\Administrator\Downloads\terms-20374.json' -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ('total terms: ' + $t.Count)

$t | ForEach-Object { ($_.note -split ('[,]' + $COMMA))[0].Trim() } | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | ForEach-Object { Write-Output ($_.Count.ToString().PadLeft(4) + '  ' + $_.Name) }

$roles = $t | Where-Object { $_.note -match $JUESE } | Sort-Object term
Write-Output ('--- character terms: ' + $roles.Count)
$roles | ForEach-Object { Write-Output ($_.term + ' = ' + $_.translation + '  [' + $_.note + ']') }
