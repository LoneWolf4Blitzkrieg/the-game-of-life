// Headless checks for world size and starting herds. Usage: node tools/test-world.js
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="sim-core">([\s\S]*?)<\/script>/)[1];
const GOL = new Function('module', src + '\nreturn GOL;')(undefined);
const test = (name, fn) => { fn(); console.log('ok -', name); };
test('world is 320 x 200 tiles', () => {
  assert.equal(GOL.W, 320); assert.equal(GOL.H, 200); assert.equal(GOL.N, 64000);
  assert.equal(GOL.W % 10, 0); assert.equal(GOL.H % 10, 0);   // chunk grid needs multiples of 10
});
test('animal cap is 24,000', () => assert.equal(GOL.MAX_ANIMALS, 24000));
test('balanced preset starts with 4x herds', () => {
  for (const s of [7919, 15838, 23757]) assert.deepEqual(GOL.createWorld(s, 'balanced').counts, [144, 320, 800, 48, 48]);
});
test('water stays about 7.5% of the map', () => {
  const w = GOL.createWorld(7919, 'balanced');
  const share = w.terrain.filter(t => t === GOL.T_WATER).length / GOL.N;
  assert.ok(share > 0.074 && share < 0.076, String(share));
});
test('empty preset starts empty', () => assert.deepEqual(GOL.createWorld(42, 'empty').counts, [0, 0, 0, 0, 0]));
test('one year runs with all five species alive', () => {
  const w = GOL.createWorld(7919, 'balanced');
  for (let t = 0; t < GOL.YEAR; t++) { GOL.step(w); w.events.length = 0; }
  assert.ok(w.counts.every(c => c > 0), w.counts.join());
  assert.ok(w.animals.length < GOL.MAX_ANIMALS);
});
console.log('test-world: all passed');
