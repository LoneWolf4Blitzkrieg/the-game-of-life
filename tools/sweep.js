// Parameter sweep: node tools/sweep.js '<json array of override sets>' [years] [seeds]
// Each override set: { "lion": {"metab":0.6}, "cheetah": {...} }
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="sim-core">([\s\S]*?)<\/script>/)[1];
const sets = JSON.parse(process.argv[2]); const years = +(process.argv[3] || 12), seeds = +(process.argv[4] || 4);
for (const ov of sets) {
  let score = 0; const fin = [];
  for (let s = 1; s <= seeds; s++) {
    const GOL = new Function('module', src + '\nreturn GOL;')(undefined);
    for (const k in ov) Object.assign(GOL.SPECIES.find(x => x.key === k), ov[k]);
    const w = GOL.createWorld(s * 7919 + 13, 'balanced');
    let minPred = 1e9, aliveYears = 0;
    for (let t = 1; t <= years * 360; t++) {
      GOL.step(w); w.events.length = 0;
      if (t % 360 === 0) { if (w.counts.every(c => c > 0)) aliveYears++; }
    }
    score += aliveYears;
    fin.push(w.counts.join('/'));
  }
  console.log(`score ${String(score).padStart(3)}/${years * seeds}  ${JSON.stringify(ov)}  end: ${fin.join('  ')}`);
}
