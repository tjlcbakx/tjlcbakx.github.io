# Listening for a Cosmic Chord

A playable, audible explanation of the (sub)mm redshift-search method of
**Bakx & Dannerbauer (2022), MNRAS 515, 678** — find a galaxy's redshift by
ear, then design the observation that would find it.

## Running it

```bash
cd game
python3 serve.py          # → http://localhost:8000
```

**It has to be served.** Double-clicking `index.html` opens it as a
`file://` URL, and every browser blocks JavaScript modules there: you get the
text with empty panels and no error. The page detects this and tells you what
to run. Any static server works — `serve.py` is just `http.server` with
caching turned off, so editing a file and reloading actually shows the edit.

## Playing it

One chapter per screen; "Onward →" appears once you have done the thing the
chapter is teaching, and "skip ahead" is always there. ← / → arrow keys page
back and forth, the dots in the header jump to any chapter you have reached,
and the chapter number is in the URL (`#4`), so reload and the browser's back
button both work. Progress is remembered in localStorage; "start over" on the
last page clears it.

Sound is the point — headphones if you have them. Every cue is also written
out in the status line under each interactive, so it is playable muted.

## The bench

`bench.html` is the same graph with the guard rails off: your own detected
frequencies, your own windows (typed as ranges, or built from `giveALMA`
tunings you can slide along a band), the redshift slider and the sound. It is
`interactives/rsg.js` in its `free` mode plus an editor, so it cannot drift
from the game or from the paper.

For each candidate it runs the chapters' own chain of reasoning — does this
identification demand lines you never saw; is it inside the photometric prior;
is anything else still standing — and prints the `RSGplot()` call for whatever
you have built, so it round-trips to the original Python. State lives in the
URL, so a setup is a link.

The depth control is the paper's §2.3.2 made playable: silence at a predicted
line is only evidence if the observation could have seen it. On *a quick look*
nothing is excluded by silence at all, so Fig. 1's two lines give two answers
instead of one; on *a deep survey* even [CI] and H2O count, and more candidates
die. Same data, different amount of looking, different conclusion.

Four cases from the paper load from cards at the top, with the answers kept out
of their names — the page is usable by someone who has no data of their own,
which is most of the people arriving from the game.

Deliberately *not* `RSGquality` — that scores a tuning against a population and
would call the Fig. 4 twins robust. Population scoring is Ch. 9's sandbox.

## The code

No frameworks, no build step, no dependencies. ES modules loaded directly.

| | |
|---|---|
| `js/physics.js` | the engine: CO ladder, band coverage, candidate redshifts, robustness, the paper's `RSGquality` score. **The only source of physics.** |
| `js/audio.js` | the sonification engine (Web Audio). Every pitch comes from `physics.js`; the contract is `SONIFICATION.md`. |
| `js/graph.js` | the Redshift Search Graph, drawn on canvas (the paper's Fig. 1) |
| `js/main.js` | chapter engine: shows one chapter, mounts/unmounts its interactives |
| `js/bench.js` | `bench.html`: the free-form RSG — an editor around the `free`-mode component |
| `js/config.js` | every real frequency the game quotes, per chapter |
| `js/interactives/` | one class per chapter interactive, `{ mount, unmount }` |
| `js/data/samples.js` | the real HerBS and SPT redshift samples |
| `test/test_physics.mjs` | 45 checks pinning the port to the original Python |

```bash
node test/test_physics.mjs     # must stay green after any physics change
```

The physics is a port of [redshift-search-graphs](https://github.com/tjlcbakx/redshift-search-graphs),
verified against it value by value.

## Acknowledgements

Built with the support of [**INFRAVIS**](https://infravis.se), the Swedish
National Infrastructure for Data Visualization. The brief — turn the paper's diagnostic figure into
something a non-astronomer can play, and give the same physics a second,
audible rendering — came out of that collaboration, and so did the decision to
treat the sonification as a representation of the data rather than an effect.

The method is Bakx & Dannerbauer (2022), MNRAS 515, 678. The redshift samples
are from Bakx et al. (2020) (HerBS) and the South Pole Telescope survey.
