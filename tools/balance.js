// Headless balance harness: extracts the sim core from index.html and runs it.
// Usage: node tools/balance.js [years=12] [seeds=5] [preset=balanced]
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// think-core (decisions) must load before sim-core, which uses its THINK global
const src = ['think-core', 'sim-core'].map(id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`))[1]).join('\n');
const GOL = new Function('module', src + '\nreturn GOL;')(undefined);
const years = +(process.argv[2] || 12), seeds = +(process.argv[3] || 5), preset = process.argv[4] || 'balanced';
const names = GOL.SPECIES.map(s => s.key.slice(0, 4));
let survivedAll = 0;
for (let s = 1; s <= seeds; s++) {
  const w = GOL.createWorld(s * 7919, preset);
  const t0 = Date.now();
  const rows = [];
  for (let t = 1; t <= years * GOL.YEAR; t++) {
    GOL.step(w); w.events.length = 0;
    if (t % 180 === 0) rows.push(`${(t / 360).toFixed(1).padStart(5)}y ` + w.counts.map((c, i) => `${names[i]}:${String(c).padStart(4)}`).join(' ') + ` g:${w.avgGrass.toFixed(2)} f:${w.fights}`);
  }
  const ms = Date.now() - t0;
  const alive = w.counts.filter(c => c > 0).length;
  if (alive === 5) survivedAll++;
  console.log(`--- seed ${s} (${ms} ms, ${(ms / (years * 360)).toFixed(2)} ms/tick) alive=${alive}`);
  if (process.env.V) console.log(rows.join('\n')); else console.log(rows.filter((_, i) => i % 2 === 1).join('\n'));
  console.log('deaths', w.deaths.map((d, i) => names[i] + JSON.stringify(d)).join(' '));
}
console.log(`ALL-5 survived in ${survivedAll}/${seeds}`);
