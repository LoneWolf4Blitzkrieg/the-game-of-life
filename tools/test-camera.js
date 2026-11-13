// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 LoneWolf4Blitzkrieg. Part of The Game of Life; see LICENSE.
// Headless checks for the camera maths in <script id="camera-core">. Usage: node tools/test-camera.js
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="camera-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'index.html has no <script id="camera-core"> block');
const CAM = new Function('module', m[1] + '\nreturn CAM;')(undefined);
const test = (name, fn) => { fn(); console.log('ok -', name); };
// The real game: 320 x 200 tiles, 6 px per tile, drawn on a 960 x 600 canvas.
const mk = () => CAM.create({ worldW: 320, worldH: 200, cell: 6, viewW: 960, viewH: 600 });

test('starts at 1x, centred', () => {
  const c = mk();
  assert.equal(c.zi, 1);
  assert.deepEqual(CAM.srcRect(c), { x: 480, y: 300, w: 960, h: 600 });
});
test('window size per zoom', () => {
  const c = mk(), s = [];
  for (let z = 0; z < 4; z++) { CAM.setZoom(c, z); const r = CAM.srcRect(c); s.push([r.w, r.h]); }
  assert.deepEqual(s, [[1920, 1200], [960, 600], [480, 300], [320, 200]]);
});
test('whole world shows everything', () => {
  assert.deepEqual(CAM.srcRect(CAM.setZoom(mk(), 0)), { x: 0, y: 0, w: 1920, h: 1200 });
});
test('zoom index is clamped', () => {
  const c = mk();
  assert.equal(CAM.setZoom(c, 9).zi, 3);
  assert.equal(CAM.setZoom(c, -1).zi, 0);
});
test('panning is clamped to the world', () => {
  const c = mk();
  assert.deepEqual(CAM.srcRect(CAM.panBy(c, -5000, -5000)), { x: 0, y: 0, w: 960, h: 600 });
  assert.deepEqual(CAM.srcRect(CAM.panBy(c, 5000, 5000)), { x: 960, y: 600, w: 960, h: 600 });
});
test('slow drags at 3x still move', () => {
  const c = CAM.setZoom(mk(), 3), x0 = c.x;
  for (let i = 0; i < 9; i++) CAM.panBy(c, 1, 0);
  assert.equal(Math.round(c.x - x0), 3);
});
test('centerOn', () => {
  const c = mk();
  assert.deepEqual(CAM.srcRect(CAM.centerOn(c, 160, 100)), { x: 483, y: 303, w: 960, h: 600 });
  assert.deepEqual(CAM.srcRect(CAM.centerOn(c, 0, 0)), { x: 0, y: 0, w: 960, h: 600 });
});
test('canvasToTile', () => {
  const c = mk();
  assert.deepEqual(CAM.canvasToTile(c, 0, 0), { x: 80, y: 50 });
  assert.deepEqual(CAM.canvasToTile(c, 959, 599), { x: 239, y: 149 });
  assert.equal(CAM.canvasToTile(c, -1, 0), null);
  assert.equal(CAM.canvasToTile(c, 960, 0), null);
  CAM.centerOn(CAM.setZoom(c, 2), 160, 100);
  assert.deepEqual(CAM.canvasToTile(c, 480, 300), { x: 160, y: 100 });
});
test('zoom keeps the tile under the anchor', () => {
  const c = mk();
  const before = CAM.canvasToTile(c, 240, 150);
  CAM.setZoom(c, 2, 240, 150);
  assert.deepEqual(CAM.canvasToTile(c, 240, 150), before);
  assert.deepEqual(CAM.srcRect(c), { x: 600, y: 375, w: 480, h: 300 });
});
test('tileToCanvas', () => {
  assert.deepEqual(CAM.tileToCanvas(mk(), 160, 100), { x: 480, y: 300 });
});
test('visibleTiles', () => {
  const c = mk();
  assert.deepEqual(CAM.visibleTiles(c), { x0: 80, y0: 50, x1: 239, y1: 149 });
  CAM.centerOn(CAM.setZoom(c, 3), 0, 0);
  assert.deepEqual(CAM.visibleTiles(c), { x0: 0, y0: 0, x1: 53, y1: 33 });
});
test('pullInside', () => {
  const c = mk();
  assert.deepEqual(CAM.pullInside(c, 10, 10), { x: 80, y: 50 });
  assert.deepEqual(CAM.pullInside(c, 300, 190), { x: 239, y: 149 });
  CAM.centerOn(CAM.setZoom(c, 3), 0, 0);
  assert.deepEqual(CAM.pullInside(c, 60, 40), { x: 52, y: 32 });
});
test('ensureVisible', () => {
  const c = mk();
  CAM.ensureVisible(c, 160, 100, 2);
  assert.deepEqual(CAM.srcRect(c), { x: 480, y: 300, w: 960, h: 600 });
  CAM.ensureVisible(c, 250, 100, 2);
  assert.deepEqual(CAM.srcRect(c), { x: 558, y: 300, w: 960, h: 600 });
});
test('minimap mapping', () => {
  const c = mk();
  assert.deepEqual(CAM.minimapToTile(c, 80, 50, 160, 100), { x: 160, y: 100 });
  assert.deepEqual(CAM.minimapViewRect(c, 160, 100), { x: 40, y: 25, w: 80, h: 50 });
});
console.log('test-camera: all passed');
