/* config.js — every tuning knob of the game, in one place.
 *
 * The table in PLAN.md ("Tuning knobs") is the spec; this is its code form.
 * Nothing else in js/ should hard-code a number that belongs here.
 */

export const CFG = {
  // --- snap test (board degrees) -------------------------------------
  snapFactor: 0.75,      // snap radius = max(snapFactor * r_deg, snapFloor)
  snapFloor: 0.5,
  nearFactor: 2.0,       // drop within nearFactor * snap of *another* source
                         // -> soft "not this one" thunk

  // --- per-piece stretch ---------------------------------------------
  bInitLo: 0.05,         // pieces start at a random b in [bInitLo, bInitHi]
  bInitHi: 0.25,         // (deliberately too dark to read)
  kneeA: 1.5,            // knee = 10 ** (kneeA - kneeB * b)
  kneeB: 2.5,

  // --- alpha ramp used when a piece sits on the sky --------------------
  alphaLo: 0.055,
  alphaHi: 0.30,
  alphaGamma: 0.75,

  // --- board -----------------------------------------------------------
  bgBoost: 1.25,          // brightness multiplier on the SPIRE backgrounds
  zoomMax: 8,            // max zoom, in units of fit-to-viewport scale
  panMargin: 0.15,       // fraction of the viewport the board may be dragged
                         // past the edge

  // --- helper overlays ---------------------------------------------------
  // Herschel's 18" beam cannot resolve these galaxies, so the SPIRE blob of a
  // curated source is not distinguishable from the thousands of other SPIRE
  // sources in a field (measured 2026-08-31). Two aids make the puzzle
  // solvable: a faint preview of each unplaced galaxy at its true position,
  // and an RA/Dec graticule.
  ghostB: 0.55,          // stretch used for the previews: always readable
  ghostAlpha: 0.34,      // ... but clearly fainter than a placed piece
  gridMinPx: 90,         // smallest on-screen spacing of graticule lines
  gridSteps: [10, 5, 2, 1, 0.5, 0.25, 0.1],   // degrees

  // --- presentation -----------------------------------------------------
  thumbPx: 96,           // tray thumbnail size (CSS px)
  inspectorPx: 240,      // inspector preview size (CSS px)
  flashMs: 700,          // snap highlight ring duration

  // --- audio -------------------------------------------------------------
  clickGain: 0.3,
};

export const STORE_KEY = 'onlineGame2.skypuzzle.v1';
