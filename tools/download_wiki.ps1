# ============================================================
# Queen's Blade Fandom Wiki downloader
# Uses the MediaWiki API (api.php) because direct page fetches
# are blocked by Cloudflare (403) for non-browser clients.
#
# Output:
#   wiki_data/manifest.json      -> list of { index, title, file }
#   wiki_data/pages/NNN.json     -> one file per article:
#        { title, displaytitle, categories[], images[], html }
#   wiki_data/download.log       -> progress log
#
# Usage:
#   powershell -File tools\download_wiki.ps1                 # full download
#   powershell -File tools\download_wiki.ps1 -Limit 3        # test run
#   powershell -File tools\download_wiki.ps1 -DelayMs 300    # slower/politer
# ============================================================
param(
    [string]$OutDir = "",
    [int]$Limit = 0,
    [int]$DelayMs = 150
)

$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot "..\wiki_data" }

$Api = 'https://queensblade.fandom.com/api.php'
$UA  = 'QBOfflineMirror/1.0 (fan-translation reference project)'

$PagesDir = Join-Path $OutDir 'pages'
New-Item -ItemType Directory -Force -Path $PagesDir | Out-Null
$LogFile = Join-Path $OutDir 'download.log'

function Log([string]$msg) {
    $line = ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg)
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function ApiGet([string]$query) {
    for ($i = 1; $i -le 5; $i++) {
        try {
            return Invoke-RestMethod -Uri ($Api + '?' + $query) -TimeoutSec 40 -UserAgent $UA
        } catch {
            Log ("retry " + $i + " after error: " + $_.Exception.Message)
            Start-Sleep -Seconds (2 * $i)
        }
    }
    throw "API failed after retries: $query"
}

# ---------- 1) enumerate all main-namespace articles ----------
Log "enumerating main-namespace pages..."
$titles = New-Object System.Collections.Generic.List[string]
$from = $null
do {
    $q = 'action=query&list=allpages&apnamespace=0&aplimit=500&format=json&formatversion=2'
    if ($from) { $q += '&apfrom=' + [uri]::EscapeDataString($from) }
    $r = ApiGet $q
    foreach ($p in $r.query.allpages) { $titles.Add($p.title) }
    if ($r.continue) { $from = $r.continue.apfrom } else { $from = $null }
} while ($from)
Log ("found " + $titles.Count + " pages")

if ($Limit -gt 0 -and $Limit -lt $titles.Count) {
    $titles = $titles.GetRange(0, $Limit)
    Log ("limited to first " + $titles.Count + " pages")
}

# ---------- 2) fetch rendered HTML for each page ----------
$manifest = New-Object System.Collections.Generic.List[object]
$done = 0
$idx = 0
foreach ($t in $titles) {
    $idx++
    $file = ('{0:D4}.json' -f $idx)
    $dest = Join-Path $PagesDir $file
    $manifest.Add([pscustomobject]@{ index = $idx; title = $t; file = $file })

    if (Test-Path $dest) { $done++; continue }   # resume support

    $q = 'action=parse&format=json&formatversion=2' +
         '&prop=text|displaytitle|categories|images' +
         '&redirects=1&page=' + [uri]::EscapeDataString($t)
    $r = ApiGet $q

    if (-not $r.parse) {
        Log ("SKIP (no parse result): " + $t)
        continue
    }

    $cats = @()
    if ($r.parse.categories) { $cats = @($r.parse.categories | ForEach-Object { $_.category }) }
    $imgs = @()
    if ($r.parse.images) { $imgs = @($r.parse.images) }

    $obj = [pscustomobject]@{
        title        = $r.parse.title
        displaytitle = $r.parse.displaytitle
        categories   = $cats
        images       = $imgs
        html         = $r.parse.text
    }
    $obj | ConvertTo-Json -Depth 5 | Out-File -FilePath $dest -Encoding utf8
    $done++
    if ($done % 25 -eq 0) { Log ("progress: " + $done + "/" + $titles.Count) }
    Start-Sleep -Milliseconds $DelayMs
}

$manifest | ConvertTo-Json -Depth 3 | Out-File -FilePath (Join-Path $OutDir 'manifest.json') -Encoding utf8
Log ("DONE: " + $done + "/" + $titles.Count + " pages saved to " + $PagesDir)
