/* main.js — boot, game state, tray/inspector UI, persistence.
 *
 *   assets  ->  pieces.js (decode/stretch/colour)
 *           ->  board.js  (sky map + placed pieces)
 *           ->  drag.js   (pointer input + snap test)
 *           ->  audio.js  (synthesised click / thunk / fanfare)
 *
 * Tuning lives in config.js and nowhere else.
 */

import { CFG, STORE_KEY } from './config.js';
import * as P from './pieces.js';
import { Board, fmtDeg } from './board.js';
import { Dragger, snapRadius } from './drag.js';
import * as Audio from './audio.js';

const $ = (id) => document.getElementById(id);

const state = {
  sources: [],            // every piece, in sources.json order
  order: [],              // shuffled tray order
  placed: new Set(),
  hints: false,
  ghosts: true,          // previews on by default: they are how the puzzle
  grid: false,           // is actually solvable (see config.js)
  drag: null,
  selected: null,
};

let board = null;
let dragger = null;
let readoutTimer = null;
let hoverField = null;
let hoverText = '';

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
                             sound: true, seenHelp: false };

function save() {
  store.placed = {};
  for (const s of state.sources) {
    if (state.placed.has(s.name)) store.placed[s.name] = Math.round(s.b * 1000) / 1000;
  }
  store.hints = state.hints;
  store.ghosts = state.ghosts;
  store.grid = state.grid;
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
  total = fieldNames.length + 1 + sourcesJson.sources.length;

  msg.textContent = 'Loading the Herschel fields…';
  const images = {};
  await Promise.all(fieldNames.map(async (n) => {
    images[n] = await P.loadImage(fieldsJson.fields[n].img);
    done++; tick();
  }));

  const lutImg = await P.loadImage('assets/ice_lut.png');
  P.initDecode(sourcesJson, P.readLut(lutImg));
  done++; tick();

  msg.textContent = 'Decoding ' + sourcesJson.sources.length + ' ALMA snapshots…';
  const rnd = mulberry32(store.seed);
  const pieces = sourcesJson.sources.map((s) => Object.assign({}, s));
  for (const p of pieces) p._b0 = CFG.bInitLo + rnd() * (CFG.bInitHi - CFG.bInitLo);

  // modest concurrency: 82 small PNGs, no need to open 82 sockets
  const queue = pieces.slice();
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const img = await P.loadImage(p.img);
      p.codes = P.readCodes(img);
      p.px = img.width;
      done++; tick();
    }
  }));

  return { fieldsJson, sourcesJson, images, pieces };
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
  $('inspCoords').textContent = skyLabel(board.radec(p.field, p.x_deg, p.y_deg));
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

function setHover(field, bx, by) {
  hoverField = field;
  if (!field) {
    hoverText = '';
  } else {
    let n = 0, t = 0;
    for (const s of state.sources) {
      if (s.field !== field) continue;
      t++;
      if (state.placed.has(s.name)) n++;
    }
    hoverText = board.fields[field].label + ' — ' + n + ' / ' + t + ' placed  ' +
                skyLabel(board.radec(field, bx, by));
  }
  showHover();
}

/** "α 217.482°  δ +00.612°" — the same convention as the graticule. */
function skyLabel([ra, dec]) {
  const sign = dec < 0 ? '\u2212' : '+';
  return '\u03b1 ' + fmtDeg(ra, 0.01) + '\u00b0  \u03b4 ' + sign +
         fmtDeg(Math.abs(dec), 0.01) + '\u00b0';
}

function updateProgress() {
  $('nplaced').textContent = state.placed.size;
  $('ntotal').textContent = state.sources.length;
  const left = state.sources.length - state.placed.size;
  $('trayCount').textContent = left + (left === 1 ? ' piece left' : ' pieces left');
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
  board.flash(p.x_deg, p.y_deg, snapRadius(p.r_deg));
  board.dirty = true;
  updateProgress();
  if (!silent) {
    Audio.click();
    say(p.name + ' — home.', 2200);
    save();
    if (state.placed.size === state.sources.length) complete();
  }
}

function complete() {
  Audio.fanfare();
  $('doneMsg').textContent = 'All ' + state.sources.length +
    ' snapshots are back where ALMA found them.';
  $('done').hidden = false;
}

// --- boot --------------------------------------------------------------------------

async function boot() {
  const { fieldsJson, images, pieces } = await loadAll();

  $('loader').hidden = true;
  $('loader').style.display = 'none';
  $('app').hidden = false;

  state.sources = pieces;
  for (const p of pieces) {
    p.b = (store.placed && store.placed[p.name] !== undefined)
      ? store.placed[p.name] : p._b0;
    if (store.placed && store.placed[p.name] !== undefined) state.placed.add(p.name);
  }

  const rnd = mulberry32(store.seed ^ 0x5f3759df);
  state.order = pieces.slice();
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }

  board = new Board($('board'), fieldsJson, images);
  state.hints = !!store.hints;
  state.ghosts = store.ghosts !== false;
  state.grid = !!store.grid;
  Audio.setEnabled(store.sound !== false);
  syncToggles();
  buildTray();

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
      say('Something belongs there — but not ' + p.name + '.', 2600);
    },
    onMiss: () => say('Not there. Try the bright blobs.', 1800),
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

function syncToggles() {
  $('btnHints').setAttribute('aria-pressed', String(state.hints));
  $('btnGhosts').setAttribute('aria-pressed', String(state.ghosts));
  $('btnGrid').setAttribute('aria-pressed', String(state.grid));
  $('btnSound').setAttribute('aria-pressed', String(Audio.isEnabled()));
  $('btnSound').textContent = Audio.isEnabled() ? 'Sound' : 'Muted';
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

function wireUI() {
  wireBackLink();
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
  toggle('btnGhosts', 'ghosts');
  toggle('btnGrid', 'grid');

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
    else if (e.key === '?') $('help').hidden = false;
    else if (e.key === 'Escape') {
      if (!$('help').hidden) $('help').hidden = true;
      else if (!$('done').hidden) $('done').hidden = true;
      else deselect();
    }
  });
}

function doReset() {
  state.placed.clear();
  for (const p of state.sources) {
    p.b = p._b0;
    p._boardCanvas = null;
    p._boardB = undefined;
  }
  deselect();
  buildTray();
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
