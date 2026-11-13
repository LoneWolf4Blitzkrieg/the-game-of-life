// In-browser UI checks for the camera, zoom, pointer, keyboard, minimap and follow features.
// Serve the folder (e.g. python3 -m http.server), open index.html?debug, then run in the console:
//   await fetch('tools/ui-check.js').then(r => r.text()).then(t => (0, eval)(t)); await uiCheck();
// Run one group with uiCheck('zoom'). Result: { passed, failed: [...], notes: [...] }.
// The script can be re-evaluated after edits: everything lives inside this function except
// window.UI_CHECKS and window.uiCheck.
(() => {
  'use strict';
  const D = window.golDebug;
  if (!D) throw new Error('golDebug missing: open index.html?debug');
  const CAM = D.CAM, cv = document.querySelector('#world');
  const W = GOL.W, H = GOL.H, VIEW_W = 960, VIEW_H = 600, T_GRASS = GOL.T_GRASS;
  const CHECKS = window.UI_CHECKS = [];
  const add = (group, name, run) => CHECKS.push({ group, name, run });

  // ---------- helpers ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Wait n animation frames. A hidden browser tab pauses requestAnimationFrame, so give up after 4 s.
  const frames = n => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('requestAnimationFrame stalled: is the page visible?')), 4000);
    const step = () => { if (n-- <= 0) { clearTimeout(t); res(); } else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const check = (cond, detail) => { if (!cond) throw new Error(detail || 'check failed'); };
  // Canvas px of the 960x600 map -> client px. With a target element, (cx, cy) are CSS px inside it.
  function client(cx, cy, el) {
    const r = (el || cv).getBoundingClientRect();
    return el ? { x: r.left + cx, y: r.top + cy } : { x: r.left + cx / VIEW_W * r.width, y: r.top + cy / VIEW_H * r.height };
  }
  // Canvas px of the centre of a tile, under the current camera.
  function tileCenter(tx, ty) {
    const p = CAM.tileToCanvas(D.cam, tx, ty), s = 6 * CAM.zoom(D.cam);
    return { x: p.x + s / 2, y: p.y + s / 2 };
  }
  // Screen px -> canvas px factor (the canvas is CSS-scaled).
  const screenToCanvas = () => VIEW_W / cv.getBoundingClientRect().width;
  function ptr(type, cx, cy, o = {}) {
    const t = o.target || cv, p = client(cx, cy, o.target), button = o.button ?? 0;
    const buttons = o.buttons ?? (type === 'pointerup' || type === 'pointerleave' || type === 'pointercancel' ? 0 : ({ 0: 1, 1: 4, 2: 2 })[button]);
    return t.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: o.id ?? 1, pointerType: o.pt || 'mouse',
      isPrimary: o.primary ?? true, button, buttons, clientX: p.x, clientY: p.y, shiftKey: !!o.shift,
    }));
  }
  // Move a pressed pointer from (x0, y0) by (dx, dy) canvas px in n steps.
  async function dragBy(x0, y0, dx, dy, o = {}, n = 4) {
    ptr('pointerdown', x0, y0, o);
    for (let i = 1; i <= n; i++) { ptr('pointermove', x0 + dx * i / n, y0 + dy * i / n, o); await frames(1); }
    ptr('pointerup', x0 + dx, y0 + dy, o);
  }
  function key(k, o = {}) {
    const t = o.target || document.body;
    return t.dispatchEvent(new KeyboardEvent(o.up ? 'keyup' : 'keydown', { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift }));
  }
  function wheel(cx, cy, deltaY, deltaMode = 0) {
    const p = client(cx, cy);
    return cv.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, deltaMode, clientX: p.x, clientY: p.y }));
  }
  // A fully visible grass tile with no animal within 6 tiles (room for a released couple).
  function freeGrassTile() {
    const w = D.world, v = CAM.visibleTiles(D.cam);
    const ok = (x, y) => {
      if (w.terrain[y * W + x] !== T_GRASS) return false;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && w.occ[Y * W + X]) return false;
      }
      return true;
    };
    for (let y = v.y0 + 8; y <= v.y1 - 8; y++) for (let x = v.x0 + 8; x <= v.x1 - 8; x++) if (ok(x, y)) return { x, y };
    throw new Error('no free grass tile in view');
  }
  const ids = () => new Set(D.world.animals.map(a => a.id));
  const newAnimals = (before, sp) => D.world.animals.filter(a => !before.has(a.id) && a.sp === sp);

  // ---------- setup / cleanup ----------
  async function setup() {
    if (document.querySelector('#titleScreen').classList.contains('show')) {
      document.querySelector('#titleScreen button[data-preset="balanced"]').click();
      await frames(2);
    }
    if (D.running) document.querySelector('#btnPlay').click();
    await cleanup();
  }
  async function cleanup() {
    for (const k of ['w', 'a', 's', 'd']) key(k, { up: true });
    for (const id of [1, 11, 12]) ptr('pointercancel', 0, 0, { id });
    if (document.querySelector('#helpScreen').classList.contains('show')) key('Escape');
    ptr('pointerleave', 0, 0, { buttons: 0 });
    key('Escape');              // inspect tool, nothing tracked
    D.resetCamera();
    await frames(2);
  }

  // ---------- group: render (Task 3) ----------
  add('render', 'default view is 1x centred', async () => {
    check(D.cam.zi === 1, 'zi ' + D.cam.zi);
    check(same(CAM.srcRect(D.cam), { x: 480, y: 300, w: 960, h: 600 }), JSON.stringify(CAM.srcRect(D.cam)));
  });
  add('render', 'hover maps to the tile under the pointer', async () => {
    const p = tileCenter(200, 120);
    ptr('pointermove', p.x, p.y, { buttons: 0 });
    check(same(D.hover, { x: 200, y: 120 }), 'hover ' + JSON.stringify(D.hover));
  });
  add('render', 'release lands where clicked', async () => {
    key('3');
    const t = freeGrassTile(), before = D.world.injected[2], had = ids(), p = tileCenter(t.x, t.y);
    ptr('pointerdown', p.x, p.y); ptr('pointerup', p.x, p.y);
    check(D.world.injected[2] === before + 1, `injected ${before} -> ${D.world.injected[2]}`);
    const fresh = newAnimals(had, 2);
    check(fresh.length === 2 && fresh.every(a => Math.max(Math.abs(a.x - t.x), Math.abs(a.y - t.y)) <= 5),
      `target ${t.x},${t.y}; new hares ${JSON.stringify(fresh.map(a => [a.x, a.y]))}`);
  });
  add('render', 'whole world shows every tile', async () => {
    CAM.setZoom(D.cam, 0);
    check(same(CAM.visibleTiles(D.cam), { x0: 0, y0: 0, x1: 319, y1: 199 }), JSON.stringify(CAM.visibleTiles(D.cam)));
  });
  add('render', 'render time', async () => {
    await frames(60);
    const one = D.renderMs;
    CAM.setZoom(D.cam, 0);
    await frames(60);
    const whole = D.renderMs;
    check(one < 8, `1x render ${one.toFixed(2)} ms`);
    check(whole < 20, `whole-world render ${whole.toFixed(2)} ms`);
    return `render ms: 1x ${one.toFixed(2)}, whole world ${whole.toFixed(2)}`;
  });

  // ---------- runner ----------
  window.uiCheck = async group => {
    await setup();
    const res = { passed: 0, failed: [], notes: [] };
    for (const c of CHECKS) {
      if (group && c.group !== group) continue;
      try { const note = await c.run(); res.passed++; if (note) res.notes.push(note); }
      catch (e) { res.failed.push(`${c.group}: ${c.name}: ${e.message}`); }
      finally { await cleanup(); }
    }
    return res;
  };
})();
