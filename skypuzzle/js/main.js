/* main.js — boot, game state, tray/inspector UI, persistence.
 *
 *   assets  ->  pieces.js (decode/stretch/colour)
 *           ->  board.js  (sky map + placed pieces)
 *           ->  drag.js   (pointer input + snap test)
 *           ->  audio.js  (synthesised click / thunk / fanfare)
 *
 * Tuning lives in config.js and nowhere else.
 */

import { CFG, DEFAULT_VIEW, DEFAULT_SET, STORE_KEY } from './config.js';
import * as P from './pieces.js';
import { Board, fmtDeg, fmtSign } from './board.js';
import { boardLayout, skyLayout, boardToRaDec } from './layout.js';
import { SkyFeatures } from './skyfeatures.js';
import { Dragger, snapRadius } from './drag.js';
import * as Audio from './audio.js';

const $ = (id) => document.getElementById(id);

const state = {
  sources: [],            // every source in the catalogue (297), name order
  active: [],             // the set in play: the stand-outs, or all of them
  set: DEFAULT_SET,       // 'standout' | 'all'
  nStandout: 0,
  order: [],              // shuffled tray order, for the set in play
  placed: new Set(),      // by name, kept across a set switch
  busy: false,            // a set switch is loading cutouts
  streak: 0,              // pieces placed in a row without a wrong drop
  best: 0,                // ... and the longest such run so far
  showStreak: true,
  hints: false,
  ghosts: true,          // previews on by default: they are how the puzzle
  grid: false,           // is actually solvable (see config.js)
  drag: null,
  selected: null,
};

let board = null;
let dragger = null;
let layouts = null;
let readoutTimer = null;
let hoverField = null;
let hoverText = '';

/** Is this source part of `set`? Stand-outs carry "so": 1 in sources.json. */
const inSet = (p, set) => set === 'all' || !!p.so;

/** How many of the set in play are placed (state.placed spans both sets). */
function placedCount() {
  let n = 0;
  for (const p of state.active) if (state.placed.has(p.name)) n++;
  return n;
}

// --- small deterministic PRNG (so a reload keeps the same tray & stretches) --

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- persistence -------------------------------------------------------------

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* private mode, corrupt value: start fresh */ }
  return null;
}

let store = loadStore() || { seed: (Math.random() * 1e9) | 0, placed: {},
                             hints: false, ghosts: true, grid: false,
                             view: DEFAULT_VIEW, set: DEFAULT_SET,
                             streak: 0, best: 0, showStreak: true,
                             sound: true, seenHelp: false };

function save() {
  store.placed = {};
  for (const s of state.sources) {
    if (state.placed.has(s.name)) store.placed[s.name] = Math.round(s.b * 1000) / 1000;
  }
  store.hints = state.hints;
  store.ghosts = state.ghosts;
  store.grid = state.grid;
  store.view = board ? board.layout.id : DEFAULT_VIEW;
  store.set = state.set;
  store.streak = state.streak;
  store.best = state.best;
  store.showStreak = state.showStreak;
  store.sound = Audio.isEnabled();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

// --- asset loading -----------------------------------------------------------

async function loadAll() {
  const bar = $('loadBar');
  const msg = $('loadMsg');
  let done = 0;
  let total = 1;
  const tick = () => { bar.style.width = (100 * done / total).toFixed(1) + '%'; };

  const [fieldsJson, sourcesJson] = await Promise.all([
    fetch('assets/fields.json').then((r) => r.json()),
    fetch('assets/sources.json').then((r) => r.json()),
  ]);

  const fieldNames = Object.keys(fieldsJson.fields);
  total = fieldNames.length + 1;

  msg.textContent = 'Loading the Herschel fields…';
  const images = {};
  await Promise.all(fieldNames.map(async (n) => {
    images[n] = await P.loadImage(fieldsJson.fields[n].img);
    done++; tick();
  }));

  const lutImg = await P.loadImage('assets/ice_lut.png');
  P.initDecode(sourcesJson, P.readLut(lutImg));
  done++; tick();

  // the real sky the fields sit on (whole-sky view); a failure here costs the
  // landmarks, not the game, so it must never stop the boot
  let sky = null;
  try {
    const [starsJson, constJson, mwImg] = await Promise.all([
      fetch('assets/sky/stars.json').then((r) => r.json()),
      fetch('assets/sky/constellations.json').then((r) => r.json()),
      P.loadImage('assets/sky/milkyway.png'),
    ]);
    sky = new SkyFeatures(starsJson, constJson, mwImg);
  } catch (e) {
    console.warn('sky landmarks unavailable:', e.message);
  }

  // Only the *metadata* of every source is read here. The cutouts themselves
  // are decoded per set, so the default game still downloads the 82 stand-outs
  // and not the 8 MB of all 297 (see useSet).
  const rnd = mulberry32(store.seed);
  const pieces = sourcesJson.sources.map((s) => Object.assign({}, s));
  for (const p of pieces) p._b0 = CFG.bInitLo + rnd() * (CFG.bInitHi - CFG.bInitLo);

  return { fieldsJson, sourcesJson, images, pieces, sky };
}

// --- the set in play ----------------------------------------------------------

function showLoader(text) {
  $('loadMsg').textContent = text;
  $('loadBar').style.width = '0%';
  $('loader').style.display = '';
  $('loader').hidden = false;
}

function hideLoader() {
  $('loader').hidden = true;
  $('loader').style.display = 'none';
}

/** Decode the cutouts of every piece in `list` that has none yet. */
async function decodeCutouts(list) {
  const need = list.filter((p) => !p.codes);
  if (!need.length) return;
  let done = 0;
  const bar = $('loadBar');
  const tick = () => { bar.style.width = (100 * done / need.length).toFixed(1) + '%'; };
  tick();
  const queue = need.slice();
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const img = await P.loadImage(p.img);
      p.codes = P.readCodes(img);
      p.px = img.width;
      done++; tick();
    }
  }));
}

/**
 * Switch to a set of pieces: 'standout' (the 82 curated ones, the default) or
 * 'all' (every ALMA snapshot in the survey). Its cutouts are fetched on first
 * use — the full set is 8 MB, and most players will never ask for it. What is
 * already placed stays placed: the two sets share `state.placed`, so finishing
 * the stand-outs and then switching leaves those 82 done.
 */
async function useSet(setName, opts = {}) {
  const wanted = state.sources.filter((p) => inSet(p, setName));
  const missing = wanted.filter((p) => !p.codes).length;
  if (missing) {
    showLoader('Decoding ' + missing + ' more ALMA snapshots…');
    await decodeCutouts(wanted);
    if (!opts.boot) hideLoader();
  }
  state.set = setName;
  state.active = wanted;

  // tray order: shuffled, but deterministic per (seed, set)
  const rnd = mulberry32((store.seed ^ (setName === 'all' ? 0x9e3779b9
                                                          : 0x5f3759df)) | 0);
  state.order = wanted.slice();
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }

  if (state.selected && !inSet(state.selected, setName)) deselect();
  buildTray();
  syncToggles();
  board.dirty = true;
  if (!opts.boot) save();
}

// --- tray & inspector ---------------------------------------------------------

function inspectorSize() {
  // never let the preview eat the sky it is meant to be dropped on
  return Math.round(Math.max(96, Math.min(CFG.inspectorPx,
                                          window.innerWidth * 0.34,
                                          window.innerHeight * 0.30)));
}

function buildTray() {
  const tray = $('tray');
  tray.textContent = '';
  for (const p of state.order) {
    if (state.placed.has(p.name)) continue;
    tray.appendChild(makeThumb(p));
  }
  updateProgress();
}

function makeThumb(p) {
  const el = document.createElement('div');
  el.className = 'thumb';
  el.dataset.name = p.name;
  const c = document.createElement('canvas');
  P.renderTo(c, p, p.b, true, CFG.thumbPx - 8);
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.textContent = p.name;
  el.append(c, cap);
  p._thumb = el;
  p._thumbCanvas = c;

  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    Audio.unlock();
    dragger.begin(p, ev, { onTap: () => select(p) });
  });
  return el;
}

function repaintPiece(p) {
  if (p._thumbCanvas) P.renderTo(p._thumbCanvas, p, p.b, true, CFG.thumbPx - 8);
  if (state.selected === p) {
    P.renderTo($('inspectorCanvas'), p, p.b, true, inspectorSize());
  }
  board.dirty = true;
}

function select(p) {
  state.selected = p;
  for (const el of document.querySelectorAll('.thumb.sel')) el.classList.remove('sel');
  if (p._thumb) {
    p._thumb.classList.add('sel');
    p._thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  const insp = $('inspector');
  insp.hidden = false;
  $('inspName').textContent = p.name;
  $('inspField').textContent = board.fields[p.field].label + ' · peak ' +
    p.peak_sigma + 'σ · shown ' + Math.round(2 * p.r_deg * 10) / 10 + '° across';
  $('inspCoords').textContent = skyLabel([p.ra_deg, p.dec_deg]);
  $('stretch').value = p.b;
  P.renderTo($('inspectorCanvas'), p, p.b, true, inspectorSize());
}

function deselect() {
  state.selected = null;
  $('inspector').hidden = true;
  for (const el of document.querySelectorAll('.thumb.sel')) el.classList.remove('sel');
}

// --- readout & progress ---------------------------------------------------------

function say(text, ms) {
  clearTimeout(readoutTimer);
  $('readout').textContent = text;
  if (ms) readoutTimer = setTimeout(showHover, ms);
}

function showHover() {
  clearTimeout(readoutTimer);
  $('readout').textContent = hoverText;
}

/** `wx === null` means the pointer left the map entirely. */
function setHover(field, wx, wy) {
  hoverField = field;
  if (wx === null) {
    hoverText = '';
  } else if (field) {
    let n = 0, t = 0;
    for (const s of state.active) {
      if (s.field !== field) continue;
      t++;
      if (state.placed.has(s.name)) n++;
    }
    hoverText = board.fields[field].label + ' — ' + n + ' / ' + t + ' placed  ' +
                skyLabel(board.radec(field, wx, wy));
  } else if (board.layout.id === 'sky') {
    // empty sky still has coordinates, and they are how you navigate it
    hoverText = skyLabel(board.layout.radec(wx, wy));
  } else {
    hoverText = '';
  }
  showHover();
}

/** "α 217.482°  δ +00.612°" — the same convention as the graticule. */
function skyLabel([ra, dec]) {
  return '\u03b1 ' + fmtDeg(ra, 0.01) + '\u00b0  \u03b4 ' + fmtSign(dec) +
         fmtDeg(Math.abs(dec), 0.01) + '\u00b0';
}

function updateProgress() {
  const n = placedCount();
  $('nplaced').textContent = n;
  $('ntotal').textContent = state.active.length;
  const left = state.active.length - n;
  $('trayCount').textContent = left + (left === 1 ? ' piece left' : ' pieces left');
}

// --- streak ---------------------------------------------------------------------
// "How many can you get in a row?" — every piece that clicks home adds one,
// every drop that does not (empty sky, or the wrong galaxy) ends the run. The
// count spans both sets and survives a reload: it is a record of aim, not of
// which puzzle was open at the time.

function updateStreak(lost) {
  const el = $('streak');
  el.hidden = !state.showStreak;
  $('streakN').textContent = state.streak;
  $('streakBest').textContent = state.best ? 'best ' + state.best : '';
  el.classList.toggle('hot', state.streak >= CFG.streakHot);
  if (lost) {                      // restart the animation, even mid-flight
    el.classList.remove('lost');
    void el.offsetWidth;
    el.classList.add('lost');
  }
}

function bumpStreak() {
  state.streak++;
  if (state.streak > state.best) state.best = state.streak;
  updateStreak();
}

function breakStreak() {
  const had = state.streak;
  state.streak = 0;
  updateStreak(had > 0);
  if (had >= CFG.streakHot) {
    say('Streak of ' + had + ' ended' +
        (state.best > had ? ' — best is ' + state.best + '.' : '.'), 2600);
  }
  save();
}

// --- placing --------------------------------------------------------------------

function place(p, silent) {
  if (state.placed.has(p.name)) return;
  state.placed.add(p.name);
  if (p._thumb && p._thumb.parentNode) p._thumb.parentNode.removeChild(p._thumb);
  p._thumb = null;
  p._thumbCanvas = null;
  p._ghostCanvas = null;      // found: the preview is never needed again
  if (state.selected === p) deselect();
  const [fx, fy] = board.layout.sourceXY(p);
  const [frx, fry] = board.layout.sourceR(p);
  const grow = snapRadius(p.r_deg) / p.r_deg;
  board.flash(fx, fy, frx * grow, fry * grow);
  board.dirty = true;
  updateProgress();
  if (!silent) {
    Audio.click();
    bumpStreak();
    say(p.name + ' — home.' +
        (state.streak >= CFG.streakHot ? '  ' + state.streak + ' in a row.' : ''),
        2200);
    save();
    if (placedCount() === state.active.length) complete();
  }
}

function complete() {
  Audio.fanfare();
  $('doneMsg').textContent = 'All ' + state.active.length + ' ' +
    (state.set === 'all' ? 'ALMA snapshots' : 'stand-out snapshots') +
    ' are back where ALMA found them.';
  $('done').hidden = false;
}

// --- boot --------------------------------------------------------------------------

async function boot() {
  const { fieldsJson, images, pieces, sky } = await loadAll();

  $('app').hidden = false;

  state.sources = pieces;
  state.nStandout = pieces.filter((p) => p.so).length;
  for (const p of pieces) {
    p.b = (store.placed && store.placed[p.name] !== undefined)
      ? store.placed[p.name] : p._b0;
    if (store.placed && store.placed[p.name] !== undefined) state.placed.add(p.name);
  }

  // every piece's true sky position, inverted from its board position once
  for (const p of pieces) {
    const [ra, dec] = boardToRaDec(fieldsJson.fields[p.field], p.x_deg, p.y_deg);
    p.ra_deg = ra;
    p.dec_deg = dec;
  }

  layouts = { board: boardLayout(fieldsJson), sky: skyLayout(fieldsJson) };
  const startView = layouts[store.view] ? store.view : DEFAULT_VIEW;
  board = new Board($('board'), fieldsJson, images, layouts[startView], sky);
  state.hints = !!store.hints;
  state.ghosts = store.ghosts !== false;
  state.grid = !!store.grid;
  state.streak = store.streak | 0;
  state.best = store.best | 0;
  state.showStreak = store.showStreak !== false;
  Audio.setEnabled(store.sound !== false);

  // the pieces themselves: the stand-outs unless a saved game says otherwise
  await useSet(store.set === 'all' ? 'all' : DEFAULT_SET, { boot: true });
  hideLoader();

  dragger = new Dragger(board, state, {
    redraw: () => { board.dirty = true; },
    onHover: (f, bx, by) => setHover(f, bx, by),
    onDragStart: (p) => {
      if (p._thumb) p._thumb.classList.add('dragging');
      $('inspector').classList.add('dragging');
      $('board').classList.add('dropping');
    },
    onDragEnd: () => {
      for (const el of document.querySelectorAll('.thumb.dragging')) {
        el.classList.remove('dragging');
      }
      $('inspector').classList.remove('dragging');
      $('board').classList.remove('dropping');
    },
    onPlace: (p) => place(p),
    onNearMiss: (p) => {
      Audio.thunk();
      breakStreak();
      say('Something belongs there — but not ' + p.name + '.', 2600);
    },
    onMiss: () => {
      breakStreak();
      say('Not there. Try the bright blobs.', 1800);
    },
  });

  wireUI();

  // Debug/QC handle: lets a console session (or a screenshot script) drive the
  // view and inspect state without touching game internals.
  window.skyPuzzle = { state, board, CFG, place, save };

  window.addEventListener('resize', () => {
    board.resize(false);
    if (state.selected) {
      P.renderTo($('inspectorCanvas'), state.selected, state.selected.b, true,
                 inspectorSize());
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => board.resize(false));
  }

  if (!store.seenHelp) {
    $('help').hidden = false;
    store.seenHelp = true;
    save();
  }

  (function frame() {
    if (board.dirty) {
      board.dirty = false;
      board.draw(state);
    }
    requestAnimationFrame(frame);
  })();
}

/** Write a button's visible label, leaving its shortcut hint alone. */
function setLabel(id, text) {
  const el = $(id);
  const lab = el.querySelector('.lab');
  (lab || el).textContent = text;
}

function syncToggles() {
  const all = state.set === 'all';
  setLabel('btnSet', all ? 'All ' + state.sources.length + ' sources'
                         : state.nStandout + ' stand-outs');
  $('btnSet').title = all
    ? 'Playing all ' + state.sources.length + ' ALMA snapshots — click for the '
      + state.nStandout + ' curated stand-outs (A)'
    : 'Playing the ' + state.nStandout + ' curated stand-outs — click for all '
      + state.sources.length + ' snapshots in the survey (A)';
  $('btnSet').setAttribute('aria-pressed', String(all));
  setLabel('btnView', board.layout.id === 'sky' ? 'Whole sky' : 'Composite');
  $('btnView').setAttribute('aria-pressed', String(board.layout.id === 'sky'));
  $('btnHints').setAttribute('aria-pressed', String(state.hints));
  $('btnGhosts').setAttribute('aria-pressed', String(state.ghosts));
  $('btnGrid').setAttribute('aria-pressed', String(state.grid));
  $('btnStreak').setAttribute('aria-pressed', String(state.showStreak));
  $('btnSound').setAttribute('aria-pressed', String(Audio.isEnabled()));
  updateStreak();
}

/**
 * The game is a page on a larger site as often as it is a page of its own, so
 * offer a way back — but only when there is somewhere to go back to, i.e. the
 * player followed a link from the same site rather than opening this directly.
 */
function wireBackLink() {
  const back = $('btnBack');
  let sameSite = false;
  try {
    sameSite = !!document.referrer &&
               new URL(document.referrer).origin === location.origin &&
               new URL(document.referrer).pathname !== location.pathname;
  } catch (e) { sameSite = false; }
  if (!sameSite) return;
  back.hidden = false;
  back.href = document.referrer;
  back.addEventListener('click', (e) => {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

function openOptions(open) {
  const panel = $('options');
  panel.hidden = !open;
  $('btnOptions').setAttribute('aria-expanded', String(open));
  if (!open) return;
  // On a narrow screen the header wraps and the Options button ends up further
  // left than the panel is wide, so anchoring the panel to the button would
  // push it off the screen. Pin it to the viewport there instead.
  const narrow = window.innerWidth < CFG.menuPinPx;
  const r = $('btnOptions').getBoundingClientRect();
  panel.style.position = narrow ? 'fixed' : '';
  panel.style.top = narrow ? Math.round(r.bottom + 6) + 'px' : '';
  panel.style.left = narrow ? '8px' : '';
  panel.style.right = narrow ? '8px' : '';
}

function wireUI() {
  wireBackLink();

  $('btnOptions').addEventListener('click', (e) => {
    e.stopPropagation();
    openOptions($('options').hidden);
  });
  // clicking a switch keeps the menu open — people change two or three at once
  $('options').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => openOptions(false));
  $('stretch').addEventListener('input', (e) => {
    const p = state.selected;
    if (!p) return;
    p.b = parseFloat(e.target.value);
    repaintPiece(p);
  });

  $('inspectorCanvas').addEventListener('pointerdown', (ev) => {
    if (!state.selected) return;
    Audio.unlock();
    dragger.begin(state.selected, ev, {});
  });

  $('btnCloseInspector').addEventListener('click', deselect);

  const toggle = (id, key) => $(id).addEventListener('click', () => {
    state[key] = !state[key];
    syncToggles();
    board.dirty = true;
    save();
  });
  toggle('btnHints', 'hints');

  $('btnView').addEventListener('click', () => {
    board.setLayout(board.layout.id === 'sky' ? layouts.board : layouts.sky);
    syncToggles();
    say(board.layout.id === 'sky'
        ? 'The real sky — the six fields at their true RA and Dec.'
        : 'The composite board — the six fields packed side by side.', 3200);
    save();
  });
  toggle('btnGhosts', 'ghosts');
  toggle('btnGrid', 'grid');
  toggle('btnStreak', 'showStreak');

  $('btnSet').addEventListener('click', async () => {
    if (state.busy) return;                  // a switch is already loading
    state.busy = true;
    const next = state.set === 'all' ? 'standout' : 'all';
    try {
      await useSet(next);
      say(next === 'all'
          ? 'Every ALMA snapshot in the survey — ' + state.active.length +
            ' of them, most of them faint blobs.'
          : 'The ' + state.active.length + ' stand-out sources.', 3600);
    } catch (e) {
      say('Could not load that set: ' + e.message, 4000);
      hideLoader();
    }
    state.busy = false;
  });

  $('btnSound').addEventListener('click', () => {
    Audio.setEnabled(!Audio.isEnabled());
    if (Audio.isEnabled()) Audio.click();
    syncToggles();
    save();
  });

  $('btnHelp').addEventListener('click', () => { $('help').hidden = false; });
  $('btnHelpClose').addEventListener('click', () => {
    $('help').hidden = true;
    Audio.unlock();
  });
  $('btnDoneClose').addEventListener('click', () => { $('done').hidden = true; });

  // two-step reset: no browser modal, no accidental wipe
  const reset = $('btnReset');
  let armed = false;
  let armTimer = null;
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.textContent = 'Sure?';
      reset.classList.add('warn');
      armTimer = setTimeout(() => {
        armed = false;
        reset.textContent = 'Reset';
        reset.classList.remove('warn');
      }, 3500);
      return;
    }
    clearTimeout(armTimer);
    armed = false;
    reset.textContent = 'Reset';
    reset.classList.remove('warn');
    doReset();
  });

  $('btnZoomIn').addEventListener('click', () => {
    board.zoomAt(board.w / 2, board.h / 2, 1.5);
  });
  $('btnZoomOut').addEventListener('click', () => {
    board.zoomAt(board.w / 2, board.h / 2, 1 / 1.5);
  });
  $('btnZoomFit').addEventListener('click', () => board.reset());

  // vertical wheel scrolls the tray horizontally
  $('tray').addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    $('tray').scrollLeft += e.deltaY;
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'h' || e.key === 'H') $('btnHints').click();
    else if (e.key === 'p' || e.key === 'P') $('btnGhosts').click();
    else if (e.key === 'g' || e.key === 'G') $('btnGrid').click();
    else if (e.key === 'f' || e.key === 'F') board.reset();
    else if (e.key === 'v' || e.key === 'V') $('btnView').click();
    else if (e.key === 'a' || e.key === 'A') $('btnSet').click();
    else if (e.key === 'k' || e.key === 'K') $('btnStreak').click();
    else if (e.key === 'o' || e.key === 'O') $('btnOptions').click();
    else if (e.key === '?') $('help').hidden = false;
    else if (e.key === 'Escape') {
      if (!$('options').hidden) openOptions(false);
      else if (!$('help').hidden) $('help').hidden = true;
      else if (!$('done').hidden) $('done').hidden = true;
      else deselect();
    }
  });
}

function doReset() {
  state.placed.clear();          // both sets: there is one board underneath
  state.streak = 0;              // the run goes, the record stays
  for (const p of state.sources) {
    p.b = p._b0;
    p._boardCanvas = null;
    p._boardB = undefined;
  }
  deselect();
  buildTray();
  updateStreak();
  board.dirty = true;
  $('done').hidden = true;
  save();
  say('Board cleared.', 1800);
}

boot().catch((err) => {
  console.error(err);
  $('loadMsg').textContent = 'Could not load the game: ' + err.message +
    '  (serve this folder over http, e.g. python -m http.server)';
  document.querySelector('.ring').style.animation = 'none';
});
