@echo off
rem SPDX-License-Identifier: GPL-3.0-or-later
rem The Game of Life: play offline WITH multicore. Double-click this file.
rem It runs offline\serve.ps1 (built-in PowerShell) to serve this folder on this computer only.
title The Game of Life (offline) - close this window to stop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0offline\serve.ps1"
if errorlevel 1 (
  echo.
  echo The offline launcher could not start. If this computer does not allow PowerShell scripts,
  echo ask your IT administrator, or play from the website once and install it as an app:
  echo https://lonewolf4blitzkrieg.github.io/the-game-of-life/
  echo You can also open index.html directly ^(one thread^).
  pause
)
