# ============================================================
# Scan downloaded wiki pages, collect <img src> urls, download
# each distinct image once (scaled variants collapse to the
# canonical /revision/latest url).
#
# Output:
#   wiki_data/images/            image files
#   wiki_data/images_map.json    { original url -> local path }
#
# Usage:
#   powershell -File tools\download_images.ps1            # all
#   powershell -File tools\download_images.ps1 -Limit 10  # test
# ============================================================
param(
    [string]$OutDir = "",
    [int]$Limit = 0,
    [int]$DelayMs = 60
)

$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot "..\wiki_data" }
$PagesDir = Join-Path $OutDir 'pages'
$ImgDir   = Join-Path $OutDir 'images'
New-Item -ItemType Directory -Force -Path $ImgDir | Out-Null

$LogFile = Join-Path $OutDir 'images.log'
function Log([string]$msg) {
    $line = ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg)
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# ---------- 1) collect <img src> urls, canonicalize ----------
Log "scanning pages for <img src> urls..."
$srcToCanon = @{}   # original src -> canonical url
Get-ChildItem $PagesDir -Filter '*.json' | ForEach-Object {
    $p = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $p.html) { return }
    foreach ($m in [regex]::Matches($p.html, '<img[^>]+src="([^"]+)"')) {
        $src = $m.Groups[1].Value
        if ($src -notmatch '^https?://') { continue }
        $canon = $src
        if ($src -match '^(https?://[^/]+/[^/]+/images/[^/]+/[^/]+/[^/]+)/revision/') {
            $canon = $Matches[1] + '/revision/latest'
        }
        # 协议化：有些 src 以 // 开头已被上面 ^https? 过滤
        $srcToCanon[$src] = $canon
    }
}
$canons = @($srcToCanon.Values | Sort-Object -Unique)
Log ("found " + $srcToCanon.Count + " img src urls -> " + $canons.Count + " distinct images")

# ---------- 2) load existing map (resume support) ----------
$mapFile = Join-Path $OutDir 'images_map.json'
$map = @{}
if (Test-Path $mapFile) {
    $h = @{}
    (Get-Content $mapFile -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties |
        ForEach-Object { $h[$_.Name] = $_.Value }
    $map = $h
}

$todo = @($canons | Where-Object { -not $map.ContainsKey($_) })
Log ("to download: " + $todo.Count + " (already mapped: " + ($canons.Count - $todo.Count) + ")")
if ($Limit -gt 0 -and $Limit -lt $todo.Count) { $todo = $todo[0..($Limit - 1)] }

$UA = 'QBOfflineMirror/1.0 (fan-translation reference project)'
$sha1 = [System.Security.Cryptography.SHA1]::Create()
$i = 0
$failed = 0
foreach ($u in $todo) {
    $i++
    $hash = [BitConverter]::ToString($sha1.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($u))).Replace('-','').Substring(0,16)
    $base = ($u -split '/revision/')[0]
    $ext = [System.IO.Path]::GetExtension($base)
    if (-not $ext) { $ext = '.jpg' }
    $local = 'images/' + $hash + $ext
    $dest = Join-Path $ImgDir ($hash + $ext)

    if (-not (Test-Path $dest)) {
        $ok = $false
        for ($try = 1; $try -le 3 -and -not $ok; $try++) {
            try {
                Invoke-WebRequest -Uri $u -OutFile $dest -TimeoutSec 40 -UserAgent $UA
                $ok = $true
            } catch {
                Start-Sleep -Seconds (2 * $try)
            }
        }
        if (-not $ok) {
            $failed++
            Log ("FAILED: " + $u)
            continue
        }
    }
    $map[$u] = $local
    if ($i % 100 -eq 0) {
        Log ("progress: " + $i + "/" + $todo.Count)
        $map | ConvertTo-Json -Depth 2 | Out-File $mapFile -Encoding utf8
    }
    Start-Sleep -Milliseconds $DelayMs
}

# expand canonical map to every original src variant
foreach ($src in $srcToCanon.Keys) {
    $c = $srcToCanon[$src]
    if ($map.ContainsKey($c)) { $map[$src] = $map[$c] }
}

$map | ConvertTo-Json -Depth 2 | Out-File $mapFile -Encoding utf8
Log ("DONE: " + ($i - $failed) + " downloaded, " + $failed + " failed; map has " + $map.Count + " urls")
