#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# The Game of Life: play offline WITH multicore (macOS / Linux). Run: ./play-offline.sh
# Serves this folder on this computer only (http://localhost) and opens your browser.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then exec python3 offline/serve.py "$@"; fi
if command -v python >/dev/null 2>&1; then exec python offline/serve.py "$@"; fi
echo "Python 3 is needed for offline multicore play. You can still open index.html directly (one thread)."
exit 1
