# The Game of Life — Predator & Prey

An educational, 16-bit-style ecosystem simulation in a single HTML file.
Every pixel-creature is one animal that eats, flees, hunts and searches for a mate on its own.
Population booms, crashes and predator–prey cycles emerge from those individual decisions.

[![The Game of Life: a savanna in the dry season with buffalo, gazelles, hares, lions and cheetahs, plus the inject panel and population charts](docs/screenshot.png)](https://lonewolf4blitzkrieg.github.io/the-game-of-life/)

**▶ Play online:** https://lonewolf4blitzkrieg.github.io/the-game-of-life/

Or open `index.html` in any modern browser. No build step and no install. It works offline too (fonts fall back to monospace).

## The species

| | Species | Breeding | Defence / strength | Notes |
|---|---|---|---|---|
| Prey A | **Buffalo** | slow (1 calf) | very resilient, herds gore attackers | most food for predators |
| Prey B | **Gazelle** | moderate (1–2) | partly resistant, fast, alarm calls | |
| Prey C | **Hare** | fast (1–3, early maturity) | weak, hides near trees/rocks | r-strategist |
| Predator A | **Lion** | slow | strongest, moderate speed, hunts cooperatively | kills rival cheetahs |
| Predator B | **Cheetah** | moderate | moderate strength, fastest (2 moves/turn) | avoids lions, picks off lion cubs |

Every birth needs a male and a female of the same species. Young predators follow their mother and share her kills.

## How to play

- **1–5**: pick an animal, then **click the map** to release a ♂+♀ couple (**Shift+click** releases 3 couples).
- **0 / Esc**: inspect tool. Hover to see an animal's age, energy and current action; click to track it.
- The savanna is 320 × 200 tiles, bigger than one screen. **Mouse wheel** or **Z / X** zoom (also the **− + ALL** buttons on the map; ALL shows the whole world). **Drag** the map or hold **W A S D** to move around (**Shift** = faster); on a phone, drag with one finger and pinch to zoom.
- **F** (or the **FOLLOW** button on the tracking card) keeps the camera on the animal you are tracking. Click or drag the **minimap** in the corner to jump anywhere.
- **Space** pause · **.** step one day · **+/−** speed (1×–16×) · **V** view mode (normal / sex / energy) · **N** new world · **M** sound · **H** help.
- Rainfall slider and wet/dry seasons change how fast grass grows.
- Complete the 8 objectives, read the field notes in the journal (they appear when something worth learning happens), and explore the **Ecology 101** tab.

## Ways to play

- **Daily Savanna:** everyone gets the same map each day (UTC). Keep it thriving for 5 years, get a Park Report, and copy your result to share.
- **Park Rating (0–1000, grades S–D):** rewards diversity, keeping all species alive, steady populations over the last year, a light touch (few releases), and time survived. It shows live under the charts.
- **Family names:** after releasing a couple, or with **NAME** on a tracked animal, give them a family name. Babies keep it; founders get name tags and descendants get little hearts on the map.
- **Predict:** press **P** or **PREDICT** to guess whether a species will go up, stay about the same, or go down over the next year. The game fast-forwards, shows the answer with reasons, and keeps your streak. Prompts also pop up at season changes; switch them off under Environment.

## Concepts it teaches

Food chains and energy pyramids · Lotka–Volterra predator–prey cycles · r- vs K-selection · carrying capacity and seasons · competition, intraguild predation and niche partitioning · prey switching · sexual reproduction, small populations and the Allee effect · trophic cascades · the Shannon biodiversity index.

## Multicore (for older and school PCs)

The whole world lives in shared memory and every simulated day runs in parallel on all your CPU cores (up to 16 threads):

1. **Grass** regrows in 16 bands of rows at once.
2. **Animals:** the map is cut into 8 vertical strips, 40 tiles wide. First every other strip runs at the same time, then the rest. Strips that run together are too far apart to touch the same tiles or animals, so moving, eating, hunting and breeding all run in parallel.

- **Same results on any CPU:** each strip has its own random numbers, newborn slots and event list, merged in a fixed order, so a world plays out identically on 1, 2, 4 or 16 threads and Daily Savanna stays fair.
- **Speed:** on a mature world the simulation runs about **+10% faster on 2 threads and about +50% on 4–16 threads** than the old single-threaded game (average +40% across 2–16 threads). See [docs/multicore-benchmark.md](docs/multicore-benchmark.md) for how this was measured and how it compares with the alternative "master + helper threads" design.
- **Turned on automatically**, using one helper per extra CPU thread; switch it off under **Environment → Multicore**.
- **Needs the online version:** shared memory requires "cross-origin isolation". GitHub Pages can't send the required headers, so the small service worker `coi-sw.js` adds them, which costs one automatic reload on the first visit. Opened straight from a file, the game runs on one thread with exactly the same results.
- **Safety net:** if a helper ever stops responding, the game finishes on the page and stays single-threaded for the rest of the session.

## Developer tools

The simulation core (`<script id="sim-core">`) has no DOM dependencies (it also runs inside the helper workers), so you can run it headlessly in Node:

```bash
node tools/balance.js 15 5 balanced   # years, seeds, preset: population report per half-year
node tools/sweep.js '[{}, {"lion":{"crowdMax":2}}]' 20 4   # score parameter overrides by coexistence
node tools/test-world.js    # world size and starting herds
node tools/test-camera.js   # camera maths (zoom, pan, screen <-> tile, minimap)
```

The camera maths lives in its own DOM-free `<script id="camera-core">`. In-browser checks for zoom, drag, keyboard, minimap and follow live in `tools/ui-check.js`: serve the folder (for example `python3 -m http.server`), open `index.html?debug`, and run this in the browser console:

```js
await fetch('tools/ui-check.js').then(r => r.text()).then(t => (0, eval)(t)); await uiCheck();
```

It returns `{ passed, failed, notes }`; `failed` should be empty. Keep the tab visible while it runs, because hidden tabs pause animation.

In testing with the default parameters (`node tools/balance.js 20 10 balanced`), the Balanced Savanna kept all five species alive for 10 years in 10 of 10 seeds, and for 20 years in 10 of 10 seeds. Extinctions can still happen, and that is part of the lesson: reintroduce the species with the inject tool.

## License

Copyright (C) 2026 LoneWolf4Blitzkrieg.

The Game of Life is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but **without any warranty**; see the license for details.

The pixel fonts (Press Start 2P and VT323) are loaded from Google Fonts and are licensed separately under the SIL Open Font License.
