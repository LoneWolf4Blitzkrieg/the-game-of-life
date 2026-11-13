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

## Concepts it teaches

Food chains and energy pyramids · Lotka–Volterra predator–prey cycles · r- vs K-selection · carrying capacity and seasons · competition, intraguild predation and niche partitioning · prey switching · sexual reproduction, small populations and the Allee effect · trophic cascades · the Shannon biodiversity index.

## Developer tools

The simulation core (`<script id="sim-core">`) has no DOM dependencies, so you can run it headlessly in Node:

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
