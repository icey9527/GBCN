# Search all page HTML for given katakana/CJK keywords (ASCII-only script, keywords via unicode escapes)
$ErrorActionPreference = 'Stop'
$PagesDir = Join-Path $PSScriptRoot "..\wiki_data\pages"

# keywords as char-code strings to keep this file ASCII
function J([int[]]$codes) { -join ($codes | ForEach-Object { [char]$_ }) }

$keywords = @{
  'ema'        = J @(0x30A8,0x30DE)                    # katakana Ema
  'emily'      = J @(0x30A8,0x30DF,0x30EA,0x30FC)      # Emily
  'sasha'      = J @(0x30B5,0x30FC,0x30B7,0x30E3)      # Sasha
  'sumeragi'   = J @(0x30B9,0x30E1,0x30E9,0x30AE)      # Sumeragi
  'selene'     = J @(0x30BB,0x30EC,0x30CD)             # Selene
  'beth'       = J @(0x30D9,0x30B9)                    # Beth
  'mam'        = J @(0x30DE,0x30FC,0x30E0)             # Mam
  'ral'        = J @(0x30E9,0x30EB)                    # Ral
  'pugle'      = J @(0x30D7,0x30FC,0x30B0,0x30EB)      # Pugle
  'may'        = J @(0x30E1,0x30A4)                    # Mei
}

Get-ChildItem $PagesDir -Filter '*.json' | ForEach-Object {
    $p = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($k in $keywords.Keys) {
        if ($p.html -and $p.html.Contains($keywords[$k])) {
            $idx = $p.html.IndexOf($keywords[$k])
            $start = [Math]::Max(0, $idx - 120)
            $len = [Math]::Min(300, $p.html.Length - $start)
            $ctx = $p.html.Substring($start, $len) -replace '<[^>]+>', ' ' -replace '\s+', ' '
            Write-Output ("[" + $k + "] " + $p.title + " :: " + $ctx)
        }
    }
}
