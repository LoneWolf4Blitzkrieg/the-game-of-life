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
    if (document.activeElement === cv) cv.blur();
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

  // ---------- group: zoom (Task 4) ----------
  const zoomText = () => document.querySelector('#zoomText').textContent;
  add('zoom', 'Z zooms in, X zooms out', async () => {
    const seq = [];
    for (const k of ['z', 'x', 'x', 'x']) { key(k); seq.push(D.cam.zi); }
    check(same(seq, [2, 1, 0, 0]), 'zi after z,x,x,x: ' + seq);
  });
  add('zoom', 'wheel zooms toward the pointer', async () => {
    const t = CAM.canvasToTile(D.cam, 240, 150);
    wheel(240, 150, -120);
    check(D.cam.zi === 2, 'zi ' + D.cam.zi);
    const u = CAM.canvasToTile(D.cam, 240, 150);
    check(same(u, t), `tile under pointer ${JSON.stringify(t)} -> ${JSON.stringify(u)}`);
  });
  add('zoom', 'wheel over the map does not scroll the page', async () => {
    const notCancelled = wheel(480, 300, 120);
    check(notCancelled === false, 'wheel event was not preventDefault()ed');
  });
  add('zoom', 'small trackpad deltas accumulate', async () => {
    for (let i = 0; i < 4; i++) wheel(480, 300, -10);
    check(D.cam.zi === 1, 'zi after 4 small deltas ' + D.cam.zi);
    wheel(480, 300, -10);
    check(D.cam.zi === 2, 'zi after 5 small deltas ' + D.cam.zi);
  });
  add('zoom', 'ALL toggles whole world and back', async () => {
    key('z');
    document.querySelector('#btnZoomAll').click();
    check(D.cam.zi === 0, 'zi after ALL ' + D.cam.zi);
    document.querySelector('#btnZoomAll').click();
    check(D.cam.zi === 2, 'zi after ALL again ' + D.cam.zi);
  });
  add('zoom', 'zoom text shows the level', async () => {
    key('z');
    check(zoomText().includes('2×'), 'text at zi 2: ' + zoomText());
    key('x'); key('x');
    check(zoomText().includes('WHOLE WORLD'), 'text at zi 0: ' + zoomText());
  });
  add('zoom', 'zoom keys ignored while help is open', async () => {
    key('h');
    check(document.querySelector('#helpScreen').classList.contains('show'), 'help did not open');
    key('z');
    check(D.cam.zi === 1, 'zi changed under help: ' + D.cam.zi);
    key('Escape');
  });

  // ---------- group: pointer (Task 5) ----------
  // Screen px -> canvas px offsets, so wobble and drag distances are real screen distances.
  const scr = px => px * screenToCanvas();
  const injected = () => D.world.injected[2];
  async function tapReleases(o) {
    key('3');
    const t = freeGrassTile(), p = tileCenter(t.x, t.y), before = injected();
    ptr('pointerdown', p.x, p.y, o);
    check(injected() === before, 'released on press');
    ptr('pointerup', p.x, p.y, o);
    check(injected() === before + 1, `injected ${before} -> ${injected()} after release`);
  }
  async function dragPans(o) {
    key('3');
    const before = injected(), x0 = CAM.srcRect(D.cam).x;
    await dragBy(480, 300, scr(40), 0, o);
    const want = Math.round(40 * VIEW_W / cv.getBoundingClientRect().width), got = x0 - CAM.srcRect(D.cam).x;
    check(injected() === before, 'a drag released a couple');
    check(Math.abs(got - want) <= 1, `window moved ${got} world px, want ${want}`);
  }
  add('pointer', 'click releases on release, not on press', () => tapReleases({}));
  add('pointer', 'small wobble still counts as a click', async () => {
    key('3');
    const t = freeGrassTile(), p = tileCenter(t.x, t.y), before = injected();
    ptr('pointerdown', p.x, p.y);
    ptr('pointermove', p.x + scr(3), p.y + scr(2));
    ptr('pointerup', p.x + scr(3), p.y + scr(2));
    check(injected() === before + 1, `injected ${before} -> ${injected()}`);
  });
  add('pointer', 'drag pans and never releases', () => dragPans({}));
  add('pointer', 'right-button drag pans; right click does nothing', async () => {
    await dragPans({ button: 2 });
    D.resetCamera();
    const t = freeGrassTile(), p = tileCenter(t.x, t.y), before = injected(), sel = D.selected;
    ptr('pointerdown', p.x, p.y, { button: 2 }); ptr('pointerup', p.x, p.y, { button: 2 });
    check(injected() === before && D.selected === sel, 'right click acted');
  });
  add('pointer', 'tooltip and preview hidden while dragging', async () => {
    const v = CAM.visibleTiles(D.cam);
    const a = D.world.animals.find(a => a.alive && a.x > v.x0 + 10 && a.x < v.x1 - 10 && a.y > v.y0 + 10 && a.y < v.y1 - 10);
    check(a, 'no animal in view');
    const p = tileCenter(a.x, a.y), tt = document.querySelector('#tooltip');
    ptr('pointermove', p.x, p.y, { buttons: 0 });
    check(getComputedStyle(tt).display !== 'none', 'tooltip not shown over an animal before the drag');
    ptr('pointerdown', p.x, p.y);
    ptr('pointermove', p.x + scr(20), p.y);
    await frames(1);
    const hidden = getComputedStyle(tt).display === 'none', cls = cv.classList.contains('dragging');
    ptr('pointerup', p.x + scr(20), p.y);
    check(hidden, 'tooltip visible mid-drag');
    check(cls, 'canvas lacks the dragging class mid-drag');
    check(!cv.classList.contains('dragging'), 'dragging class left after release');
  });
  add('pointer', 'touch tap releases, touch drag pans', async () => {
    await tapReleases({ pt: 'touch', id: 11 });
    D.resetCamera();
    await dragPans({ pt: 'touch', id: 11 });
  });
  add('pointer', 'pinch zooms', async () => {
    const o1 = { pt: 'touch', id: 11 }, o2 = { pt: 'touch', id: 12, primary: false };
    ptr('pointerdown', 430, 300, o1); ptr('pointerdown', 430 + scr(100), 300, o2);
    ptr('pointermove', 430 + scr(160), 300, o2);
    const zi = D.cam.zi;
    ptr('pointerup', 430 + scr(160), 300, o2); ptr('pointerup', 430, 300, o1);
    check(zi === 2, 'zi after pinch-out ' + zi);
  });

  // ---------- group: keyboard (Task 6) ----------
  // Hold a key for n frames; returns how far the window moved in world px.
  async function hold(k, n, o = {}) {
    const x0 = CAM.srcRect(D.cam).x;
    key(k, o); await frames(n); key(k, { up: true, shift: o.shift });
    return CAM.srcRect(D.cam).x - x0;
  }
  // Focus the map with the keyboard cursor (no mouse), starting from the view-centre tile.
  function keyboardCursor() { cv.focus(); ptr('pointerleave', 0, 0, { buttons: 0 }); }
  add('keyboard', 'D pans right while held', async () => {
    const moved = await hold('d', 10);
    check(moved > 0, 'window moved ' + moved);
  });
  add('keyboard', 'Shift+D pans faster than D', async () => {
    const t0 = performance.now(), slow = await hold('d', 10), t1 = performance.now();
    D.resetCamera();
    const fast = await hold('D', 10, { shift: true }), t2 = performance.now();
    const ratio = (fast / (t2 - t1)) / (slow / (t1 - t0));
    check(ratio > 1.8, `speed ratio ${ratio.toFixed(2)} (slow ${slow}, fast ${fast})`);
    return `Shift+D / D pan speed ratio ${ratio.toFixed(2)}`;
  });
  add('keyboard', 'pan keys ignored while help is open', async () => {
    key('h');
    check(document.querySelector('#helpScreen').classList.contains('show'), 'help did not open');
    const moved = await hold('d', 10);
    key('Escape');
    check(moved === 0, 'window moved under help ' + moved);
  });
  add('keyboard', 'arrow cursor scrolls the camera', async () => {
    keyboardCursor();
    for (let i = 0; i < 20; i++) key('ArrowRight', { shift: true, target: cv });
    check(D.hover && D.hover.x === 260, 'hover ' + JSON.stringify(D.hover));
    const v = CAM.visibleTiles(D.cam);
    check(v.x1 >= 262, 'visible x1 ' + v.x1);
  });
  add('keyboard', 'panning pulls the cursor into view', async () => {
    keyboardCursor();
    key('ArrowRight', { target: cv });
    check(D.hover, 'no keyboard cursor');
    CAM.panBy(D.cam, -3000, 0);
    await frames(2);
    const h = D.hover, want = h && CAM.pullInside(D.cam, h.x, h.y);
    check(h && same(h, want), `hover ${JSON.stringify(h)}, fully visible would be ${JSON.stringify(want)}`);
  });
  add('keyboard', 'Enter acts in view', async () => {
    key('3');
    const t = freeGrassTile();
    CAM.centerOn(D.cam, t.x, t.y);
    await frames(1);
    keyboardCursor();
    const before = injected(), had = ids();
    key('Enter', { target: cv });
    check(injected() === before + 1, `injected ${before} -> ${injected()} (cursor ${JSON.stringify(D.hover)}, target ${t.x},${t.y})`);
    const v = CAM.visibleTiles(D.cam), fresh = newAnimals(had, 2);
    check(fresh.length === 2 && fresh.every(a => a.x >= v.x0 && a.x <= v.x1 && a.y >= v.y0 && a.y <= v.y1),
      'new pair ' + JSON.stringify(fresh.map(a => [a.x, a.y])) + ' view ' + JSON.stringify(v));
  });

  // ---------- group: minimap (Task 7) ----------
  const mm = () => document.querySelector('#minimap');
  const wrapEl = document.querySelector('#wrap');
  // The minimap only shows on maps at least 600 px wide; on a narrower pane these checks can't run.
  const wideEnough = () => wrapEl.clientWidth >= 600;
  add('minimap', 'visible at 1x, hidden at whole world', async () => {
    if (!wideEnough()) return 'skipped: pane too narrow';
    check(mm() && mm().classList.contains('show'), 'minimap not shown at 1x');
    key('x');
    check(!mm().classList.contains('show'), 'minimap shown at whole world');
  });
  add('minimap', 'click jumps the camera', async () => {
    if (!wideEnough()) return 'skipped: pane too narrow';
    CAM.panBy(D.cam, -3000, -3000);
    ptr('pointerdown', 80, 50, { target: mm() }); ptr('pointerup', 80, 50, { target: mm() });
    const c = CAM.canvasToTile(D.cam, 480, 300);
    check(c && Math.abs(c.x - 160) <= 1 && Math.abs(c.y - 100) <= 1, 'view centre tile ' + JSON.stringify(c));
  });
  add('minimap', 'minimap drag never releases animals', async () => {
    if (!wideEnough()) return 'skipped: pane too narrow';
    key('3');
    const before = injected();
    ptr('pointerdown', 40, 30, { target: mm() });
    ptr('pointermove', 70, 50, { target: mm() });
    ptr('pointerup', 70, 50, { target: mm() });
    check(injected() === before, 'a minimap drag released a couple');
    const c = CAM.canvasToTile(D.cam, 480, 300);
    check(c && Math.abs(c.x - 140) <= 1 && Math.abs(c.y - 100) <= 1, 'drag did not move the view: ' + JSON.stringify(c));
  });
  add('minimap', 'hidden on narrow maps', async () => {
    if (!wideEnough()) return 'skipped: pane too narrow';
    wrapEl.style.maxWidth = '500px';
    try {
      await sleep(300); await frames(1);
      check(!mm().classList.contains('show'), 'minimap shown on a 500 px map');
    } finally { wrapEl.style.maxWidth = ''; }
    await sleep(300);
  });

  // ---------- group: follow (Task 8) ----------
  const followText = () => (document.querySelector('#btnFollow') || {}).textContent;
  const inView = a => { const v = CAM.visibleTiles(D.cam); return a.x >= v.x0 && a.x <= v.x1 && a.y >= v.y0 && a.y <= v.y1; };
  // Track a living lion by clicking it with the inspect tool.
  async function trackLion() {
    const a = D.world.animals.find(a => a.alive && a.sp === 3);
    check(a, 'no living lion');
    CAM.centerOn(D.cam, a.x, a.y);
    await frames(1);
    key('0');
    const p = tileCenter(a.x, a.y);
    ptr('pointerdown', p.x, p.y); ptr('pointerup', p.x, p.y);
    check(D.selected === a, 'click did not track the lion');
    return a;
  }
  add('follow', 'F without a tracked animal shows a hint', async () => {
    D.setSelected(null);
    key('f');
    check(D.follow === false, 'follow turned on with nothing tracked');
    const t = document.querySelector('#toast').textContent;
    check(t.includes('CLICK AN ANIMAL'), 'toast: ' + t);
  });
  add('follow', 'F follows the tracked animal', async () => {
    const a = await trackLion();
    key('f');
    check(D.follow === true, 'F did not start following');
    for (let i = 0; i < 20; i++) key('.');
    await frames(5);
    check(a.alive, 'the lion died during the check (rerun)');
    check(inView(a), `lion at ${a.x},${a.y} not in view ${JSON.stringify(CAM.visibleTiles(D.cam))}`);
    check(D.follow === true, 'follow stopped');
    check(followText() === 'FOLLOWING', 'button text ' + followText());
  });
  add('follow', 'dragging stops following', async () => {
    await trackLion();
    key('f');
    check(D.follow === true, 'F did not start following');
    ptr('pointerdown', 480, 300);
    ptr('pointermove', 480 + scr(20), 300); ptr('pointermove', 480 + scr(40), 300);
    await frames(1);
    const f = D.follow;
    ptr('pointerup', 480 + scr(40), 300);
    check(f === false, 'still following after a drag');
    await sleep(300);
    check(followText() === 'FOLLOW', 'button text ' + followText());
  });
  add('follow', 'death stops following', async () => {
    const errs = [], onErr = e => errs.push(e.message);
    window.addEventListener('error', onErr);
    const orig = console.error; console.error = (...a) => { errs.push(a.join(' ')); orig(...a); };
    try {
      const a = D.world.animals.find(a => a.alive && a.sp === 3), twin = Object.assign({}, a);
      D.setSelected(twin); D.setFollow(true);
      check(D.follow === true, 'follow did not start');
      twin.alive = false;
      await frames(2);
      check(D.follow === false, 'still following a dead animal');
      await sleep(300);
    } finally { window.removeEventListener('error', onErr); console.error = orig; }
    check(errs.length === 0, 'errors: ' + errs.join(' | '));
  });
  add('follow', 'whole-world picking is wider', async () => {
    check(D.pickRadius() === 1, 'radius at 1x ' + D.pickRadius());
    key('x');
    check(D.cam.zi === 0 && D.pickRadius() === 2, 'radius at whole world ' + D.pickRadius());
  });

  // ---------- group: hardening (final-review fixes) ----------
  add('hardening', 'following keeps the keyboard cursor in view', async () => {
    await trackLion();
    key('f');
    check(D.follow, 'F did not start following');
    keyboardCursor();
    for (let i = 0; i < 20; i++) key('ArrowRight', { shift: true, target: cv });
    await frames(2);
    const h = D.hover, want = h && CAM.pullInside(D.cam, h.x, h.y);
    check(h && same(h, want), `cursor ${JSON.stringify(h)} not fully visible (would be ${JSON.stringify(want)})`);
  });
  add('hardening', 'pinch, first finger lifts: the other finger pans', async () => {
    const o1 = { pt: 'touch', id: 11 }, o2 = { pt: 'touch', id: 12, primary: false };
    ptr('pointerdown', 400, 300, o1); ptr('pointerdown', 400 + scr(100), 300, o2);
    ptr('pointermove', 400 + scr(160), 300, o2);
    ptr('pointerup', 400, 300, o1);
    const x0 = CAM.srcRect(D.cam).x;
    for (let i = 1; i <= 4; i++) { ptr('pointermove', 400 + scr(160 + 10 * i), 300, o2); await frames(1); }
    ptr('pointerup', 400 + scr(200), 300, o2);
    check(CAM.srcRect(D.cam).x < x0, `window x ${x0} -> ${CAM.srcRect(D.cam).x}`);
  });
  add('hardening', 'a pan after a pinch stops following', async () => {
    await trackLion();
    key('f');
    const o1 = { pt: 'touch', id: 11 }, o2 = { pt: 'touch', id: 12, primary: false };
    ptr('pointerdown', 400, 300, o1); ptr('pointerdown', 400 + scr(100), 300, o2);
    ptr('pointerup', 400 + scr(100), 300, o2);
    for (let i = 1; i <= 4; i++) { ptr('pointermove', 400 + scr(15 * i), 300, o1); await frames(1); }
    const f = D.follow;
    ptr('pointerup', 400 + scr(60), 300, o1);
    check(f === false, 'still following after a one-finger pan');
  });
  add('hardening', 'a lost release does not leave the map sliding', async () => {
    key('3');
    ptr('pointerdown', 480, 300);
    ptr('pointermove', 480 + scr(20), 300); ptr('pointermove', 480 + scr(40), 300);
    // the release never arrives; the mouse moves with no button held
    const x0 = CAM.srcRect(D.cam).x;
    ptr('pointermove', 480 + scr(140), 300, { buttons: 0 });
    check(CAM.srcRect(D.cam).x === x0, `map slid with no button held: ${x0} -> ${CAM.srcRect(D.cam).x}`);
    const t = freeGrassTile(), p = tileCenter(t.x, t.y), before = injected();
    ptr('pointerdown', p.x, p.y); ptr('pointerup', p.x, p.y);
    check(injected() === before + 1, 'next click was swallowed');
  });
  add('hardening', 'release far from the press is a drag, not a click', async () => {
    key('3');
    const t = freeGrassTile(), p = tileCenter(t.x, t.y), before = injected();
    ptr('pointerdown', p.x, p.y); ptr('pointerup', p.x + scr(40), p.y);
    check(injected() === before, 'a 40 px press-release acted');
  });
  add('hardening', 'wheel over the minimap and zoom bar zooms, not the page', async () => {
    for (const el of [document.querySelector('#minimap'), document.querySelector('#btnZoomIn')]) {
      D.resetCamera();
      const r = el.getBoundingClientRect();
      const ok = el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120, clientX: r.left + 5, clientY: r.top + 5 }));
      check(ok === false && D.cam.zi === 2, `#${el.id}: page scroll not prevented or no zoom (zi ${D.cam.zi})`);
    }
  });
  add('hardening', 'touch tap with an 8 px wobble releases at the press point', async () => {
    key('3');
    const t = freeGrassTile(), p = tileCenter(t.x, t.y), before = injected(), had = ids(), o = { pt: 'touch', id: 11 };
    ptr('pointerdown', p.x, p.y, o);
    ptr('pointermove', p.x + scr(8), p.y, o);
    ptr('pointerup', p.x + scr(8), p.y, o);
    check(injected() === before + 1, 'tap with 8 px wobble did not release');
    const fresh = newAnimals(had, 2);
    check(fresh.some(a => a.x === t.x && a.y === t.y), `not released at the press tile ${t.x},${t.y}: ${JSON.stringify(fresh.map(a => [a.x, a.y]))}`);
  });
  add('hardening', 'zoom buttons keep the map focused', async () => {
    for (const id of ['#btnZoomIn', '#btnZoomOut', '#btnZoomAll']) {
      const ok = ptr('pointerdown', 5, 5, { target: document.querySelector(id) });
      check(ok === false, id + ' pointerdown would take focus from the map');
    }
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
