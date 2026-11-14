/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 LoneWolf4Blitzkrieg. Part of The Game of Life; see LICENSE.
 *
 * "Play Offline (Windows).exe": play The Game of Life offline WITH multicore on Windows 7 and later.
 *
 * Browsers only allow multicore (shared memory) on pages sent with two security headers, which a
 * file opened from disk can never have. This tiny program serves the game folder (the folder the
 * .exe sits in) on this computer only, http://127.0.0.1, with those headers, and opens your
 * browser. Close its window to stop. No PowerShell, Python, install or internet needed.
 *
 * Build (on Linux):  offline/build-windows.sh
 *   i686-w64-mingw32-gcc -O2 -s -o "Play Offline (Windows).exe" offline/launcher.c -lws2_32 -lshell32
 */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <string.h>

static char root[MAX_PATH];   /* the game folder, ending in a backslash */

static const char *type_of(const char *path) {
  static const char *map[][2] = {
    { ".html", "text/html; charset=utf-8" }, { ".js", "text/javascript" }, { ".json", "application/json" },
    { ".webmanifest", "application/manifest+json" }, { ".png", "image/png" }, { ".css", "text/css" },
    { ".md", "text/plain; charset=utf-8" }, { ".txt", "text/plain; charset=utf-8" },
  };
  const char *dot = strrchr(path, '.');
  size_t i;
  if (dot) for (i = 0; i < sizeof map / sizeof map[0]; i++) if (!_stricmp(dot, map[i][0])) return map[i][1];
  return "application/octet-stream";
}

static int hexval(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

/* Decode %XX in place and cut off any ?query or #fragment. */
static void url_decode(char *s) {
  char *o = s;
  for (; *s && *s != '?' && *s != '#'; s++) {
    if (*s == '%' && hexval(s[1]) >= 0 && hexval(s[2]) >= 0) { *o++ = (char)(hexval(s[1]) * 16 + hexval(s[2])); s += 2; }
    else *o++ = *s;
  }
  *o = 0;
}

static int send_all(SOCKET c, const char *buf, int len) {
  while (len > 0) { int n = send(c, buf, len, 0); if (n <= 0) return 0; buf += n; len -= n; }
  return 1;
}

static void send_status(SOCKET c, const char *status) {
  char head[512];
  int n = _snprintf(head, sizeof head,
    "HTTP/1.1 %s\r\nContent-Type: text/plain\r\nContent-Length: %d\r\n"
    "Cross-Origin-Opener-Policy: same-origin\r\nCross-Origin-Embedder-Policy: require-corp\r\n"
    "Cross-Origin-Resource-Policy: same-origin\r\nConnection: close\r\n\r\n%s",
    status, (int)strlen(status), status);
  send_all(c, head, n);
}

/* One browser connection: read the request, send one file, close. */
static DWORD WINAPI serve(LPVOID arg) {
  SOCKET c = (SOCKET)(UINT_PTR)arg;
  char req[8192], path[2048], full[MAX_PATH * 2], head[1024], buf[65536];
  int got = 0, head_only;
  char *sp1, *sp2;

  while (got < (int)sizeof req - 1) {   /* read the request line and headers */
    int n = recv(c, req + got, (int)sizeof req - 1 - got, 0);
    if (n <= 0) break;
    got += n; req[got] = 0;
    if (strstr(req, "\r\n\r\n")) break;
  }
  req[got] = 0;
  sp1 = strchr(req, ' ');
  sp2 = sp1 ? strchr(sp1 + 1, ' ') : NULL;
  if (!sp1 || !sp2 || sp2 - sp1 - 1 >= (int)sizeof path) { send_status(c, "400 Bad Request"); goto done; }
  head_only = !strncmp(req, "HEAD ", 5);
  if (strncmp(req, "GET ", 4) && !head_only) { send_status(c, "405 Method Not Allowed"); goto done; }
  memcpy(path, sp1 + 1, sp2 - sp1 - 1); path[sp2 - sp1 - 1] = 0;
  url_decode(path);

  {   /* only plain files inside the game folder */
    char *p = path;
    while (*p == '/') p++;
    if (!*p) p = "index.html";
    if (strstr(p, "..") || strchr(p, ':') || strchr(p, '\\') || strlen(root) + strlen(p) >= sizeof full) { send_status(c, "404 Not Found"); goto done; }
    strcpy(full, root); strcat(full, p);
    for (p = full; *p; p++) if (*p == '/') *p = '\\';
  }
  {
    HANDLE f = CreateFileA(full, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    DWORD size, rd;
    int n;
    if (f == INVALID_HANDLE_VALUE || (GetFileAttributesA(full) & FILE_ATTRIBUTE_DIRECTORY)) {
      if (f != INVALID_HANDLE_VALUE) CloseHandle(f);
      send_status(c, "404 Not Found"); goto done;
    }
    size = GetFileSize(f, NULL);
    n = _snprintf(head, sizeof head,
      "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %lu\r\n"
      "Cross-Origin-Opener-Policy: same-origin\r\nCross-Origin-Embedder-Policy: require-corp\r\n"
      "Cross-Origin-Resource-Policy: same-origin\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
      type_of(full), (unsigned long)size);
    if (send_all(c, head, n) && !head_only)
      while (ReadFile(f, buf, sizeof buf, &rd, NULL) && rd > 0) if (!send_all(c, buf, (int)rd)) break;
    CloseHandle(f);
  }
done:
  shutdown(c, SD_SEND);
  closesocket(c);
  return 0;
}

int main(void) {
  WSADATA wsa;
  SOCKET s = INVALID_SOCKET;
  struct sockaddr_in addr;
  char url[128], check[MAX_PATH * 2], *slash;
  int port, on = 1;

  SetConsoleTitleA("The Game of Life (offline) - close this window to stop");
  GetModuleFileNameA(NULL, root, sizeof root);
  slash = strrchr(root, '\\');
  if (slash) slash[1] = 0;
  strcpy(check, root); strcat(check, "index.html");
  if (GetFileAttributesA(check) == INVALID_FILE_ATTRIBUTES) {
    printf("index.html was not found next to this program.\nKeep \"Play Offline (Windows).exe\" in the game folder.\n\nPress Enter to close.");
    getchar(); return 1;
  }
  if (WSAStartup(MAKEWORD(2, 2), &wsa)) { printf("Networking is not available.\nPress Enter to close."); getchar(); return 1; }

  for (port = 8123; port < 8143; port++) {   /* first free port on this computer only */
    s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) break;
    setsockopt(s, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char *)&on, sizeof on);
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons((u_short)port);
    if (!bind(s, (struct sockaddr *)&addr, sizeof addr) && !listen(s, 64)) break;
    closesocket(s); s = INVALID_SOCKET;
  }
  if (s == INVALID_SOCKET) { printf("Could not start: no free port between 8123 and 8142.\nPress Enter to close."); getchar(); return 1; }

  _snprintf(url, sizeof url, "http://127.0.0.1:%d/index.html", port);
  printf("The Game of Life is running at %s\n", url);
  printf("Keep this window open while you play. Close it to stop.\n");
  if ((INT_PTR)ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL) <= 32)
    printf("Could not open a browser; open %s yourself.\n", url);

  for (;;) {
    SOCKET c = accept(s, NULL, NULL);
    HANDLE t;
    if (c == INVALID_SOCKET) continue;
    t = CreateThread(NULL, 0, serve, (LPVOID)(UINT_PTR)c, 0, NULL);
    if (t) CloseHandle(t); else closesocket(c);
  }
}
