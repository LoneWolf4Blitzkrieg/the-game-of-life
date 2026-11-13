# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 LoneWolf4Blitzkrieg. Part of The Game of Life; see LICENSE.
#
# Play The Game of Life offline WITH multicore (macOS / Linux; any OS with Python 3).
# Browsers only allow multicore (shared memory) on pages sent with two security headers, which a
# file opened from disk can never have. This serves the game folder on this computer only
# (http://localhost) with those headers and opens your browser. No internet is needed.
# Start it with play-offline.sh or "Play Offline (Mac).command"; close the window to stop.
import http.server, os, socket, sys, webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the game folder
os.chdir(ROOT)

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.webmanifest': 'application/manifest+json', '.js': 'text/javascript'}
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *args):
        pass

def free_port(start=8123, tries=20):
    for port in range(start, start + tries):
        with socket.socket() as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    sys.exit('No free port between %d and %d.' % (start, start + tries - 1))

port = free_port()
url = 'http://localhost:%d/index.html' % port
server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
print('The Game of Life is running at %s' % url, flush=True)
print('Keep this window open while you play. Close it (or press Ctrl+C) to stop.', flush=True)
if '--no-browser' not in sys.argv:
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
