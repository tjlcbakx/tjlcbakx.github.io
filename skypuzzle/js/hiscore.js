/* hiscore.js — the high-score screen, done the way a pinball machine does it:
 * a phosphor board, and three letters you dial in one at a time.
 *
 * Everything it shows comes from score.js, which reads and writes one
 * localStorage key. There is no network here and there is not meant to be:
 * this is *your* machine's table (see the ground rule in CLAUDE.md).
 */

import * as Score from './score.js';

const $ = (id) => document.getElementById(id);

let table = Score.load();
let view = 'standout';       // which of the two boards is on screen
let pending = null;          // { set, entry } still waiting for its initials
let letters = ['A', 'A', 'A'];
let slot = 0;                // which wheel the cursor is on
let mark = -1;               // row to light up: the one just entered
let cells = [];              // the three letter cells, for repainting

const SETS = { standout: 'Stand-outs', all: 'All 297' };

export function init() {
  $('hsTabStandout').addEventListener('click', () => show('standout'));
  $('hsTabAll').addEventListener('click', () => show('all'));
  $('btnHsOk').addEventListener('click', commit);
  $('btnHsClose').addEventListener('click', close);
  buildWheels();
  // capture, so the game's own shortcuts stay out of the way while the
  // machine is asking for letters
  document.addEventListener('keydown', onKey, true);
}

export function isOpen() { return !$('hiscore').hidden; }

/** Would this score make the board? */
export function qualifies(set, score) {
  return Score.rankOf(table[set === 'all' ? 'all' : 'standout'], score) >= 0;
}

/**
 * Show the board. `entry` (optional) is a finished run — { s, ms } — which
 * takes its place in the table as soon as its initials are dialled in.
 */
export function open(set, entry) {
  view = set === 'all' ? 'all' : 'standout';
  mark = -1;
  pending = (entry && qualifies(view, entry.s))
    ? { set: view, entry: { ...entry, n: '', d: Score.today() } } : null;
  if (pending) {
    letters = Score.cleanName(table.me).split('');
    slot = 0;
  }
  $('hiscore').hidden = false;
  render();
}

export function close() {
  commit();                       // never walk away from a score half-entered
  $('hiscore').hidden = true;
}

function show(set) {
  if (pending) return;            // finish the entry before browsing
  view = set;
  mark = -1;
  render();
}

// --- the entry ----------------------------------------------------------------

function buildWheels() {
  const wrap = $('hsWheels');
  cells = [];
  for (let i = 0; i < Score.NAME_LEN; i++) {
    const col = document.createElement('div');
    col.className = 'wheel';
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'step';
    up.textContent = '▲';
    up.setAttribute('aria-label', 'Next letter');
    const cell = document.createElement('div');
    cell.className = 'cell';
    const down = up.cloneNode(true);
    down.textContent = '▼';
    down.setAttribute('aria-label', 'Previous letter');
    up.addEventListener('click', () => { slot = i; cycle(1); });
    down.addEventListener('click', () => { slot = i; cycle(-1); });
    cell.addEventListener('click', () => { slot = i; paintEntry(); });
    col.append(up, cell, down);
    wrap.appendChild(col);
    cells.push(cell);
  }
}

function cycle(d) {
  const A = Score.ALPHABET;
  const i = A.indexOf(letters[slot]);
  letters[slot] = A[(i + d + A.length) % A.length];
  paintEntry();
}

function paintEntry() {
  cells.forEach((c, i) => {
    c.textContent = letters[i];       // .cell is fixed-size: a blank holds
    c.classList.toggle('on', i === slot && !!pending);
  });
  const live = document.querySelector('#hsList .you .nm');
  if (live) live.textContent = letters.join('');
}

function commit() {
  if (!pending) return;
  const name = Score.cleanName(letters.join(''));
  table.me = name.trim() || 'AAA';
  pending.entry.n = name;
  const rows = table[pending.set];
  mark = Score.insert(rows, pending.entry);
  Score.save(table);
  view = pending.set;
  pending = null;
  render();
}

// --- the board ----------------------------------------------------------------

function render() {
  $('hsTabStandout').setAttribute('aria-pressed', String(view === 'standout'));
  $('hsTabAll').setAttribute('aria-pressed', String(view === 'all'));
  $('hsTabStandout').disabled = $('hsTabAll').disabled = !!pending;

  const rows = table[view].slice();
  let youAt = -1;
  if (pending) {
    youAt = Score.rankOf(rows, pending.entry.s);
    rows.splice(youAt, 0, { ...pending.entry, n: letters.join('') });
  }

  const list = $('hsList');
  list.innerHTML = '';
  for (let i = 0; i < Score.TABLE_MAX; i++) {
    const r = rows[i];
    const li = document.createElement('li');
    if (!r) li.className = 'empty';
    else if (i === youAt) li.className = 'you';
    else if (i === mark) li.className = 'fresh';
    li.append(
      span('rk', String(i + 1)),
      span('nm', r ? r.n : '---'),
      span('sc', r ? Score.fmtScore(r.s) : '000000'),
      span('tm', r ? Score.fmtTime(r.ms) : '--:--'));
    list.appendChild(li);
  }

  $('hsEntry').hidden = !pending;
  $('btnHsOk').hidden = !pending;
  $('btnHsClose').hidden = !!pending;
  // the standing line said what the title now says: only the wheels need a word
  $('hsTip').hidden = !pending;
  $('hsTip').textContent = pending ? 'Arrow keys, the buttons, or just type' : '';
  if (pending) paintEntry();
}

function span(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

// --- keys ---------------------------------------------------------------------

function onKey(e) {
  if (!isOpen()) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (!pending) {
    if (e.key === 'Escape') { stop(); close(); }
    return;
  }
  const k = e.key;
  if (k === 'Enter' || k === 'Escape') { stop(); commit(); }
  else if (k === 'ArrowUp') { stop(); cycle(1); }
  else if (k === 'ArrowDown') { stop(); cycle(-1); }
  else if (k === 'ArrowLeft') { stop(); slot = (slot + Score.NAME_LEN - 1) % Score.NAME_LEN; paintEntry(); }
  else if (k === 'ArrowRight') { stop(); slot = (slot + 1) % Score.NAME_LEN; paintEntry(); }
  else if (k === 'Backspace') {
    stop();
    letters[slot] = ' ';
    slot = Math.max(0, slot - 1);
    paintEntry();
  } else if (k.length === 1 && Score.ALPHABET.includes(k.toUpperCase())) {
    stop();
    letters[slot] = k.toUpperCase();
    if (slot < Score.NAME_LEN - 1) slot++;
    paintEntry();
  }
}
