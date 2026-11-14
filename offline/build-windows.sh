#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Builds "Play Offline (Windows).exe" from offline/launcher.c (32-bit, so it runs on 32- and
# 64-bit Windows 7 and later). Needs MinGW: sudo apt install gcc-mingw-w64-i686
set -e
cd "$(dirname "$0")/.."
i686-w64-mingw32-gcc -O2 -s -Wall -static -o "Play Offline (Windows).exe" offline/launcher.c -lws2_32 -lshell32
echo "Built: Play Offline (Windows).exe"
