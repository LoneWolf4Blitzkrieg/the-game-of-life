# Multicore: Option B vs Option C

The game used to run everything on one browser thread. Two designs were built and measured.

## The two designs

**Option B — master thread + helper threads.** The page keeps the animals as JavaScript objects and runs each day itself. Only the animals' decisions ("thinking", the most expensive read-only part) are copied into shared memory each morning and shared out to helper Web Workers.

**Option C — true multicore by map strips.** All world state lives in shared typed arrays. Each day runs in three parallel phases: grass regrowth in 16 row bands, then one colour of 8 map strips (40 tiles wide), then the other colour. Same-colour strips can't touch each other's tiles or animals, so moving, eating, hunting and breeding all run in parallel too.

Both give **identical results on any number of threads** (same world after hundreds of days on 1, 2, 4 and 16 threads), so Daily Savanna stays fair.

## How it was measured

- Chrome (the Claude desktop browser pane), page served with cross-origin isolation, on a 16-thread desktop CPU; thread counts were limited in software to imitate 2-, 4-, 8- and 16-thread machines.
- Mature worlds: each seed (777, 778, 779) was fast-forwarded 1,300 days, then 300 days were timed.
- Speed is **milliseconds per 1,000 animal-days** (lower is better), because the builds' populations differ.
- The old single-threaded game, Option B and Option C were measured in **two interleaved rounds** (old → B → C → old, then C → B → old), and each option is compared with the mean of the old game's runs (0.642). The machine's speed drifted between rounds, which affects all three builds alike.

## Results

| Threads | Old game | Option B | Option C | B vs old | C vs old |
|---|---|---|---|---|---|
| 1 | 0.642 | 0.754 | 0.674 | −14.9% | −4.7% |
| 2 | | 0.765 | 0.583 | −16.1% | **+10.2%** |
| 4 | | 0.706 | 0.430 | −9.0% | **+49.4%** |
| 8 | | 0.646 | 0.421 | −0.6% | **+52.6%** |
| 16 | | 0.627 | 0.433 | +2.4% | **+48.2%** |
| **Average, 2–16 threads** | | | | **−5.8%** | **+40.1%** |
| Average of 2 and 16 | | | | −6.9% | +29.2% |

("+x%" means that much more simulation per second than the old game.)

In an earlier, quieter session Option B reached about +9% (2 threads) to +26% (16 threads), an average of about +20%. Even its best run falls well short of Option C.

## Why C wins

Option B can only share out the thinking, about a third of the browser's work, and it adds a daily snapshot copy on the master. Everything else (moving, eating, hunting, births) stays on one thread, so B levels off around 8 threads and barely breaks even on 2. Option C runs all of that in parallel. It levels off at 4 threads, because each phase has 4 strips, which matches the quad-core school PCs this was aimed at.

## Changes that came with Option C

- **Movement fix:** unused movement used to pile up while an animal rested, so a cheetah could sprint 70+ tiles in one day after a long rest. Animals now never exceed their real speed. This was a bug in the old game too, and the strip layout depends on the fix.
- **Lost sight:** an animal forgets a target or mother more than 26 tiles away at the end of a day and decides again next day.
- **Random order:** each strip has its own random order and random numbers, so a given seed now grows a different (but equally valid) world than before; the Daily Savanna maps changed once.
