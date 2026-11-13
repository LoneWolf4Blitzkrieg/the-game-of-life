# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 LoneWolf4Blitzkrieg. Part of The Game of Life; see LICENSE.
#
# Play The Game of Life offline WITH multicore (Windows 7 and later; uses built-in PowerShell).
# Browsers only allow multicore (shared memory) on pages sent with two security headers, which a
# file opened from disk can never have. This serves the game folder on this computer only
# (http://localhost) with those headers and opens your browser. No internet or install needed.
# Start it with "Play Offline (Windows).bat"; close the window to stop.

# PowerShell 2.0 (Windows 7) has no $PSScriptRoot, so work out the folder the old way.
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = [System.IO.Path]::GetFullPath((Join-Path $here '..'))
if (-not $root.EndsWith('\')) { $root = $root + '\' }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.json' = 'application/json';
  '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'; '.css' = 'text/css';
  '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
}

# Find a free port on this computer.
$listener = $null
$port = 8123
while ($port -lt 8143) {
  $try = New-Object System.Net.HttpListener
  $try.Prefixes.Add("http://localhost:$port/")
  try { $try.Start(); $listener = $try; break } catch { $port++ }
}
if ($listener -eq $null) {
  Write-Host 'Could not start: no free port between 8123 and 8142.'
  Read-Host 'Press Enter to close'
  exit 1
}

$url = "http://localhost:$port/index.html"
Write-Host "The Game of Life is running at $url"
Write-Host 'Keep this window open while you play. Close it to stop.'
try { Start-Process $url } catch { Write-Host "Could not open a browser; open $url yourself." }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root ($path -replace '/', '\')))
    $res.Headers.Add('Cross-Origin-Opener-Policy', 'same-origin')
    $res.Headers.Add('Cross-Origin-Embedder-Policy', 'require-corp')
    $res.Headers.Add('Cross-Origin-Resource-Policy', 'same-origin')
    $res.Headers.Add('Cache-Control', 'no-cache')
    if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
      $res.StatusCode = 404
    } else {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $type = $types[$ext]
      if ($type -eq $null) { $type = 'application/octet-stream' }
      $res.ContentType = $type
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    try { $res.StatusCode = 500 } catch { }
  } finally {
    try { $res.Close() } catch { }
  }
}
