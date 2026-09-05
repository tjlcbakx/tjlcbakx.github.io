/* score.js — the arcade score, and the high-score table behind it.
 *
 * The table lives in its own localStorage key, not in the game's save:
 * "Reset" clears the board and a STORE_KEY bump retires an old save, but
 * neither should ever wipe the hall of fame.
 *
 * Nothing in here talks to the network. The table is this browser's own.
 * Every weight it scores with is a knob in config.js (SCORE).
 */

import { SCORE as RULES, SCORE_KEY } from './config.js';

export { SCORE_KEY } from './config.js';
export const TABLE_MAX = RULES.tableMax;
export const NAME_LEN = RULES.nameLen;

/** The wheel each initial cycles through — arcade order, blank last. */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.- ';

/** Par for a set: the point at which the time bonus runs out. */
export function parMs(pieces) { return RULES.parSec * pieces * 1000; }

export function timeBonus(run) {
  if (!run.timed) return 0;              // a board the clock never saw
  const under = (parMs(run.pieces) - run.ms) / 1000;
  return under > 0 ? Math.round(under * RULES.perSec) : 0;
}

/**
 * The score, broken into the lines the completion sheet prints.
 * run = { set, pieces, streak, notes, misses, ms, timed }
 */
export function tally(run) {
  const rows = [
    { k: 'Pieces placed', n: run.pieces, each: RULES.perPiece },
    { k: 'Longest run',   n: run.streak, each: RULES.perStreak },
    { k: 'Notes found',   n: run.notes,  each: RULES.perNote },
    { k: 'Wrong drops',   n: run.misses, each: RULES.perMiss },
  ].map((r) => ({ ...r, pts: r.n * r.each }));
  rows.push({
    k: 'Time', n: null, each: null, pts: timeBonus(run),
    note: run.timed ? fmtTime(run.ms) + ' of ' + fmtTime(parMs(run.pieces))
                    : 'not timed',
  });
  // A disastrous run can dig itself below zero on wrong drops alone; the board
  // does not print negative scores.
  const total = Math.max(0, rows.reduce((s, r) => s + r.pts, 0));
  return { rows, total };
}

// --- formatting ---------------------------------------------------------------

export function fmtTime(ms) {
  if (ms === null || ms === undefined || !isFinite(ms)) return '--:--';
  const s = Math.round(ms / 1000);
  const p2 = (v) => String(v).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return (h ? h + ':' + p2(Math.floor(s / 60) % 60) : Math.floor(s / 60)) +
         ':' + p2(s % 60);
}

/** "015680" — arcade zero padding, and a column that never jumps. */
export function fmtScore(n) {
  return String(Math.max(0, Math.round(n))).padStart(6, '0');
}

/** Three characters of the wheel, nothing else, blanks kept for alignment. */
export function cleanName(s) {
  let out = '';
  for (const ch of String(s || '').toUpperCase()) {
    if (out.length >= NAME_LEN) break;
    if (ALPHABET.includes(ch)) out += ch;
  }
  return out.padEnd(NAME_LEN, ' ');
}

// --- the table ----------------------------------------------------------------

const blank = () => ({ v: 1, me: 'AAA', standout: [], all: [] });

/** One row: { n: 'TJB', s: 15680, ms: 724331|null, d: '2026-09-05' } */
export function load() {
  try {
    const t = JSON.parse(localStorage.getItem(SCORE_KEY));
    if (t && t.v === 1) {
      const rows = (a) => (Array.isArray(a) ? a : [])
        .filter((r) => r && isFinite(r.s))
        .slice(0, TABLE_MAX);
      return { v: 1, me: cleanName(t.me).trim() || 'AAA',
               standout: rows(t.standout), all: rows(t.all) };
    }
  } catch (e) { /* private mode, or a corrupt value: an empty hall of fame */ }
  return blank();
}

export function save(t) {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(t)); } catch (e) { /* ignore */ }
}

/**
 * Where a score would land, 0-based, or -1 if it misses the table. A tie goes
 * to the row already there: you have to beat the board, not match it.
 */
export function rankOf(rows, score) {
  let i = 0;
  while (i < rows.length && rows[i].s >= score) i++;
  return i < TABLE_MAX ? i : -1;
}

export function insert(rows, entry) {
  const i = rankOf(rows, entry.s);
  if (i < 0) return -1;
  rows.splice(i, 0, entry);
  if (rows.length > TABLE_MAX) rows.length = TABLE_MAX;
  return i;
}

/** Today, as the table stores it. */
export function today() {
  const d = new Date();
  const p2 = (v) => String(v).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}
