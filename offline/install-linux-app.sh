#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 LoneWolf4Blitzkrieg. Part of The Game of Life; see LICENSE.
#
# Adds "The Game of Life" to your Linux applications menu (offline, with multicore), for this
# user only. It points at this game folder, so keep the folder where it is (or run this again
# after moving it). Remove it with:  offline/install-linux-app.sh --uninstall
set -e
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ENTRY="$APPS/the-game-of-life.desktop"

if [ "$1" = "--uninstall" ]; then
  rm -f "$ENTRY"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" 2>/dev/null || true
  echo "Removed The Game of Life from the applications menu."
  exit 0
fi

GAME="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$GAME/index.html" ] && [ -f "$GAME/play-offline.sh" ] || { echo "Run this from inside the game folder."; exit 1; }
command -v python3 >/dev/null 2>&1 || echo "Note: Python 3 is needed to play (sudo apt install python3)."

mkdir -p "$APPS"
cat > "$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=The Game of Life
GenericName=Ecosystem game
Comment=Educational 16-bit predator-prey game (offline, multicore). Close the terminal window to stop.
Exec=sh "$GAME/play-offline.sh"
Path=$GAME
Icon=$GAME/icon-512.png
Terminal=true
Categories=Game;Simulation;
Keywords=ecology;education;predator;prey;simulation;biology;
EOF
chmod +x "$ENTRY"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" 2>/dev/null || true
echo "Added The Game of Life to your applications menu (Games)."
echo "It opens a small terminal window (the local game server) and your browser. Close that window to stop."
