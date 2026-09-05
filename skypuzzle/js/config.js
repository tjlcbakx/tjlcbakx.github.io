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
  zoomMax: 8,            // max zoom, in units of fit-to-viewport scale ...
  maxPxPerDeg: 220,      // ... but never less than this, which is what the
                         // whole-sky view needs (its fit scale is ~4 px/deg)
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

  // --- the sky itself (whole-sky view only) ------------------------------
  // Real data, baked in by scripts/export_sky.py: without it the six
  // footprints read as loose patches in black rather than as places on the
  // sky. Alphas are deliberately low — this is background, and the survey
  // panels have to stay the brightest thing on screen.
  mwAlpha: 0.34,          // Milky Way glow: background, not subject
  starMagLimit: 6.0,      // faintest star drawn (the catalogue's own limit)
  starMinPx: 0.55,        // screen radius of a magnitude-6 star ...
  starMaxPx: 2.5,         // ... and of Sirius. Stars are points: no zoom scaling
  starGlowMag: 1.6,       // brighter than this gets a halo
  starGlowScale: 5.0,
  starOverMag: 3.2,       // bright stars redrawn *over* the footprints ...
  starOverAlpha: 0.35,    // ... additively, so a panel sits in the sky
  starNameMag: 1.3,       // named at any zoom (~15 stars, no pile-ups)
  starNameMagZoom: 2.6,   // named once zoomed past starNameZoomPx
  starNameZoomPx: 9,
  starNameAlpha: 0.34,
  constColour: 'rgb(150,175,235)',
  constAlpha: 0.12,       // constellation figures
  constLabelAlpha: 0.14,
  constMaxPxPerDeg: 45,   // ... faded out past this zoom: they are landmarks
  galacticAlpha: 0.16,    // dashed galactic equator, now backed by the glow
  skyBg: '#03050e',       // the empty sky: not quite black
  skyPanelAlpha: 0.94,    // footprints let a little sky through
  featherDeg: 0.5,        // soft edge on each footprint, in degrees of sky
  skyDarkCut: 26,         // luma (0-255) below which a footprint pixel fades
                          // out: kills the black padding round each tilted
                          // field so the stars show through it

  // --- solved pieces -----------------------------------------------------
  // The mark on a galaxy the player has put in place. It is the UI accent,
  // deliberately *not* the teal of the hint rings: those mean "still to find".
  solvedColour: 'rgba(127, 216, 232, 0.80)',
  solvedPad: 1.15,       // bracket box, in units of the piece's drawn radius
  solvedArm: 0.42,       // arm length, in units of the smaller half-box
  solvedLabelMinPx: 9,   // name it once the piece is this big on screen (px
                         // radius): keeps the whole sky free of text
  solvedLabelColour: 'rgba(190, 226, 240, 0.90)',
  solvedLabelBg: 'rgba(6, 8, 16, 0.50)',

  // --- presentation -----------------------------------------------------
  thumbPx: 96,           // tray thumbnail size (CSS px)
  inspectorPx: 240,      // inspector preview size (CSS px)
  flashMs: 700,          // snap highlight ring duration

  // --- options menu ------------------------------------------------------
  menuPinPx: 560,        // below this viewport width the menu is pinned to the
                         // viewport, not to its button (the header wraps)

  // --- streak ------------------------------------------------------------
  streakHot: 3,          // from this many in a row, the counter lights up and
                         // losing the run is worth a word

  // --- audio -------------------------------------------------------------
  clickGain: 0.3,
};

// --- the score ---------------------------------------------------------------
// What a finished board is worth. Arcade rules: one number, every part of it
// printed on the completion sheet. Placing pieces is the bulk of it; the rest
// pays for aim (a long run, few wrong drops), curiosity (notes read) and
// speed, in that order of weight. `parSec` is the seconds a piece is "meant"
// to take — the point at which the time bonus runs out — and `perSec` what
// every second under that par is worth.
export const SCORE = {
  perPiece: 100,
  perStreak: 50,
  perNote: 150,
  perMiss: -150,
  parSec: 18,
  perSec: 5,
  tableMax: 10,          // rows on the high-score board
  nameLen: 3,            // letters a pinball machine asks for
};

// --- which map ---------------------------------------------------------------
// 'sky'   the real celestial sphere, pan through 0h, fields at their true
//         RA/Dec, over the Milky Way and the constellations — the default: it
//         is what the survey actually looks like, and it says where it is
// 'board' the reference figure's packed composite of the six fields: tighter on
//         screen, no sky around it (key V)
export const DEFAULT_VIEW = 'sky';

// --- which pieces ------------------------------------------------------------
// 'standout' the 86 curated stand-out sources (CURATED in export_assets.py) —
//            the default: the ones worth looking at, and a game you can finish
// 'all'      every ALMA snapshot in the survey, 297 of them, most of them
//            faint blobs. Its cutouts (8 MB) load only when asked for (key A)
export const DEFAULT_SET = 'standout';

// v2: the default view changed to 'board' and the sky gained real stars, so
// old saved state would otherwise keep sending people back to the old default.
export const STORE_KEY = 'onlineGame2.skypuzzle.v2';

// The hall of fame is deliberately *not* in STORE_KEY: "Reset" clears the
// board and a STORE_KEY bump retires an old save, and neither should ever
// wipe a record.
export const SCORE_KEY = 'onlineGame2.skypuzzle.scores.v1';

// A save remembers the view it was left in, which would otherwise keep
// returning players on the *previous* default for ever. Bump this whenever
// DEFAULT_VIEW changes: the stored view is reset once, on the next boot, and
// nothing else in the save (placed pieces, streak, options) is touched.
export const VIEW_REV = 2;
