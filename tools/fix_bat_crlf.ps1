# Convert a text file to CRLF line endings (ASCII-only script)
param([string]$File)
$c = [IO.File]::ReadAllText($File)
$c = $c -replace "`r?`n", "`r`n"
[IO.File]::WriteAllText($File, $c)
Write-Output ("CRLF fixed: " + $File)
