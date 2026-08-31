// bench.js — the free-form Redshift Search Graph: put in your own lines and
// your own tunings and listen to the result. This is the game's Ch. 4-7
// component (`interactives/rsg.js`) in its 'free' mode, wrapped in an editor
// for the things the chapters hard-code. Nothing here computes physics; the
// graph, the candidates and every tone still come from physics.js and audio.js,
// so the bench cannot disagree with the game or with the paper.
//
// The vocabulary deliberately mirrors RSG.py's RSGplot(): filter_down /
// filter_up, sl_freq_obs, z_phot, nr_of_CO_lines, redshift_down / redshift_up.
// The panel at the bottom prints the RSGplot call this state corresponds to,
// so anything you build here can be taken straight back to the original tool.

import { SonificationEngine } from './audio.js';
import { RSG } from './interactives/rsg.js';
import { el, button, slider } from './ui.js';
import { lineSet, giveALMA } from './physics.js';

const audio = new SonificationEngine();

// ALMA bands RSG.py's giveALMA knows about, with their edges for the labels.
const ALMA_BANDS = {
  3: [84, 116], 4: [125, 163], 5: [158, 211], 6: [211, 275],
  7: [275, 373], 8: [385, 500], 9: [602, 720], 10: [787, 950],
};

// --- state -----------------------------------------------------------------
// windows are kept as their *recipe*, not as flattened spans, so an ALMA tuning
// stays draggable after it has been added.
//   { type: 'alma', band, ratio }  → giveALMA's two sidebands
//   { type: 'span', lo, hi }       → one literal range
const state = {
  name: 'my source',
  detected: [93.463, 155.772],
  windows: [
    { type: 'span', lo: 89.1, hi: 112.0 },
    { type: 'span', lo: 139.9, hi: 162.7 },
  ],
  zPhot: null,
  dz: 0.13,
  nCO: 20,
  // How deep the observation was — i.e. whether silence at a predicted line is
  // evidence at all. The paper's §2.3.2 in one control.
  depth: 'normal',
  zMin: 0,
  zMax: 7,
  z: 0.4,
};

// Flatten the recipes into the [[lo,hi],…] every physics function wants.
function spansOf(w) {
  if (w.type === 'alma') {
    const { lsb, usb } = giveALMA(w.band, w.ratio);
    return [lsb, usb];
  }
  return [[w.lo, w.hi]];
}
const bandsOf = () => state.windows.flatMap(spansOf).filter(([lo, hi]) => hi > lo);

// --- presets ---------------------------------------------------------------

const TUNINGS = {
  'the paper\u2019s optimum — Band 3 + Band 4': [
    { type: 'span', lo: 89.1, hi: 112.0 },
    { type: 'span', lo: 139.9, hi: 162.7 },
  ],
  'one ALMA Band 3 tuning': [{ type: 'alma', band: 3, ratio: 0.5 }],
  'Band 3 scan (5 tunings)': [0, 0.25, 0.5, 0.75, 1]
    .map((r) => ({ type: 'alma', band: 3, ratio: r })),
  'Band 3 + Band 6': [
    { type: 'alma', band: 3, ratio: 0.5 },
    { type: 'alma', band: 6, ratio: 0.5 },
  ],
};

// Real sources from the paper, framed as cases rather than examples, and with
// the answer kept out of the name — it is the thing you are here to find.
const CASES = [
  {
    title: 'Two notes',
    blurb: 'Two lines, 93.463 and 155.772 GHz, and nothing else to go on. '
      + 'Two redshifts fit them both. One of the two is lying — and the data '
      + 'you already have is enough to catch it.',
    detected: [93.463, 155.772], zPhot: null, depth: 'normal',
  },
  {
    title: 'One note and a hunch',
    blurb: 'A single line at 144.089 GHz. On its own it fits a dozen redshifts. '
      + 'But the galaxy\u2019s colours give a fuzzy guess at the answer — enough, '
      + 'with the silences, to get to one.',
    detected: [144.089], zPhot: 3.0, depth: 'normal',
  },
  {
    title: 'The honest failure',
    blurb: 'Two lines, a colour guess, and a pair of answers that fit equally '
      + 'perfectly. The astronomers who published this one wrote down "we cannot '
      + 'tell yet". See whether you agree with them.',
    detected: [107.229, 160.844], zPhot: 2.3, depth: 'normal',
  },
  {
    title: 'Nothing at all',
    blurb: 'No detections — just windows. This is the view from before the '
      + 'observation, when you are choosing where to listen.',
    detected: [], zPhot: null, depth: 'normal',
  },
];

// --- the live component ----------------------------------------------------

let rsg = null;
let rebuildTimer = null;
const graphHost = el('div', { class: 'interactive' });

function configFromState() {
  return {
    mode: 'free',
    bands: bandsOf(),
    detected: state.detected.filter(Number.isFinite),
    lines: lineSet({ nCO: state.nCO, includeFaint: true }),
    classifyLines: lineSet({ nCO: state.nCO, includeFaint: false }),
    zMin: state.zMin,
    zMax: state.zMax,
    startZ: Math.min(Math.max(state.z, state.zMin), state.zMax),
    photz: state.zPhot == null ? null : { z: state.zPhot, dz: state.dz },
  };
}

// A change of lines or windows changes the graph's whole background, so the
// component is rebuilt rather than patched — the same path the chapter engine
// takes when it mounts one. Debounced, because the ratio slider fires fast.
function rebuild({ now = false } = {}) {
  clearTimeout(rebuildTimer);
  const go = () => {
    if (rsg) { state.z = rsg.z; rsg.unmount(); rsg = null; }
    const bands = bandsOf();
    if (!bands.length) {
      graphHost.innerHTML = '';
      graphHost.append(el('p', { class: 'note center',
        text: 'Add at least one observing window and the graph appears.' }));
      renderVerdict();
      return;
    }
    graphHost.innerHTML = '';
    rsg = new RSG();
    rsg.mount(graphHost, { audio, config: configFromState(), onComplete: () => {} });
    renderVerdict();
    syncHash();
  };
  if (now) go(); else rebuildTimer = setTimeout(go, 140);
}

// --- verdict: the game's own chain of reasoning, per source ----------------

// Deliberately NOT RSGquality's grid test. That metric asks a survey-design
// question — "across a population, would a galaxy at this redshift come out
// pinned down?" — and on its terms the Fig. 4 pair at z = 1.15 and 3.30 both
// score robust, because their twin is far away in redshift. For one real
// source with one real photometric prior that is the wrong answer, and it is
// the exact mistake this method exists to prevent. So the bench asks the three
// questions the chapters ask, in order:
//
//   1. does this candidate demand lines you never saw?        → dead
//   2. is it inside the photometric prior, if you have one?   → dead if not
//   3. is anything else still standing?                       → ambiguous
//
// RSGquality is still the right tool for scoring a *tuning*; that is Ch. 9.
function verdicts() {
  if (!rsg || !bandsOf().length) return [];
  const list = rsg.targets.map((t) => ({
    z: t.z,
    label: t.members ? t.members.map((m) => m.line.name).join(' + ') : t.line.name,
    // A deep observation can hold [CI] and H2O to the same standard; a normal
    // one cannot, so their absence proves nothing (§2.3.2).
    ghosts: rsg.predictedButUndetected(t.z, { includeFaint: state.depth === 'deep' }),
  })).sort((a, b) => a.z - b.z);

  // 1. silence — but only if the observation was deep enough for silence to
  //    mean anything. A shallow look that saw nothing has proved nothing, and
  //    that is the single easiest way to publish a wrong redshift.
  for (const v of list) {
    if (!v.ghosts.length) continue;
    const names = v.ghosts.slice(0, 3)
      .map((g) => `${g.name} at ${g.obsFreq.toFixed(2)} GHz`).join(', ');
    const more = v.ghosts.length > 3 ? ', …' : '';
    if (state.depth === 'shallow') {
      // Survives, and stays in the running — so the other candidates have to
      // count it among the things they cannot be told apart from.
      v.note = `it also predicts ${names}${more}, none of which you list — but on `
        + 'a quick look those could simply have been too faint to show, so their '
        + 'silence proves nothing.';
      continue;
    }
    v.tag = 'excluded';
    v.why = `also predicts ${names}${more} — inside your windows, and not among `
      + 'your detected lines. An observation this deep would have seen them, so '
      + 'this redshift is refuted by a spectrum you already have.';
  }

  // 2. the photometric prior, at the paper's sigma = dz(1+z).
  if (state.zPhot != null) {
    const sigma = state.dz * (1 + state.zPhot);
    for (const v of list) {
      if (v.tag) continue;
      const n = Math.abs(v.z - state.zPhot) / sigma;
      if (n <= 3) continue;
      v.tag = 'excluded';
      v.why = `${n.toFixed(1)} sigma away from the colour guess of ${state.zPhot} `
        + `± ${sigma.toFixed(2)}. The photometry is fuzzy, but not that fuzzy.`;
    }
  }

  // 3. whatever is still standing. More than one, and nothing you have
  //    separates them — which is an answer, and usually the honest one.
  const alive = list.filter((v) => !v.tag);
  for (const v of alive) {
    if (alive.length === 1) {
      v.tag = 'robust';
      v.why = 'the only identification that fits your detected lines and predicts '
        + 'nothing you failed to see.'
        + (v.note ? ` Note that ${v.note}` : '');
    } else {
      const others = alive.filter((o) => o !== v).map((o) => `z = ${o.z.toFixed(3)}`);
      v.tag = 'ambiguous';
      v.why = `fits, and so does ${others.join(' and ')}. Nothing in this dataset `
        + 'separates them: you need more bandwidth, another line, or a deeper look.'
        + (v.note ? ` And ${v.note}` : '');
    }
  }
  return list;
}

const verdictNode = el('div', { class: 'bench-verdict' });

function renderVerdict() {
  verdictNode.innerHTML = '';
  const list = verdicts();
  if (!rsg) return;
  if (!state.detected.length) {
    verdictNode.append(el('p', { class: 'note',
      text: 'No detected lines: the graph is showing pure coverage — which lines '
        + 'would be in your windows at each redshift. Add a line to get candidates.' }));
  } else if (!list.length) {
    verdictNode.append(el('p', { class: 'note',
      text: 'No redshift in range puts any known line at those frequencies. '
        + 'Widen the redshift range, add rungs, or check the frequencies.' }));
  } else {
    const alive = list.filter((v) => v.tag !== 'excluded').length;
    verdictNode.append(el('p', { class: 'task',
      text: `${list.length} candidate redshift${list.length > 1 ? 's' : ''}, `
        + `${alive} still standing — click one to go there, hover for why.` }));
    const wrap = el('div', { class: 'chips' });
    for (const v of list) {
      const b = button(`z = ${v.z.toFixed(3)} · ${v.label}`, () => {
        rsg.setZ(v.z); rsg.zSlider.set(v.z); rsg.release();
      }, { class: `chip chip-btn chip-${v.tag}`, attrs: { title: v.why } });
      wrap.append(b);
    }
    verdictNode.append(wrap, el('p', { class: 'note legend' }, [
      el('span', {}, [el('span', { class: 'sw robust' }), 'the answer ']),
      el('span', {}, [el('span', { class: 'sw ambiguous' }), 'fits, but so does a twin ']),
      el('span', {}, [el('span', { class: 'sw excluded' }), 'ruled out — hover for what killed it']),
    ]));
  }
  const code = rsgpyCall();
  const copy = button('copy', async (e) => {
    try {
      await navigator.clipboard.writeText(code);
      e.target.textContent = 'copied';
      setTimeout(() => { e.target.textContent = 'copy'; }, 1600);
    } catch { /* clipboard blocked: the text is on screen anyway */ }
  }, { class: 'btn small ghost' });
  verdictNode.append(
    el('div', { class: 'bench-row' }, [
      el('h3', { text: 'the same thing, as an astronomer would type it' }), copy,
    ]),
    el('p', { class: 'bench-hint',
      text: 'RSG.py is the Python program the paper\u2019s authors wrote and '
        + 'published, and this is the command that would rebuild what is on '
        + 'screen. Run it and you get this graph as a file — which is how the '
        + 'figures in a paper or a telescope proposal actually get made.' }),
    el('pre', { class: 'bench-code', text: code }),
  );
}

// The RSGplot() call this state corresponds to. The point of the bench is that
// you can take what you built here back to the original tool.
function rsgpyCall() {
  const bands = bandsOf();
  const down = bands.map(([lo]) => +lo.toFixed(3)).join(',');
  const up = bands.map(([, hi]) => +hi.toFixed(3)).join(',');
  const sl = state.detected.filter(Number.isFinite).map((f) => +f.toFixed(3));
  const args = [
    `[${down}]`, `[${up}]`, `'${state.name.replace(/'/g, '')}'`,
    state.zPhot == null ? null : `z_phot=${state.zPhot}`,
    sl.length ? `sl_freq_obs=[${sl.join(',')}]` : null,
    state.zMin ? `redshift_down=${state.zMin}` : null,
    state.zMax !== 7 ? `redshift_up=${state.zMax}` : null,
    state.nCO !== 20 ? `nr_of_CO_lines=${state.nCO}` : null,
    state.dz !== 0.13 ? `dzUncertainty=${state.dz}` : null,
  ].filter(Boolean);
  return `import RSG\nRSG.RSGplot(${args.join(', ')})`;
}

// --- controls --------------------------------------------------------------

// Deliberately a text field, not <input type="number">. In a decimal-comma
// locale the number widget silently rejects "93,463" — you get an empty value
// and no complaint — and a good half of the people this bench is for type that
// way. Accept both, and say so when the text is not a number at all.
const num = (value, oninput, opts = {}) => {
  const n = el('input', {
    type: 'text', inputmode: 'decimal', class: 'bench-num', value: String(value),
    'aria-label': opts.label ?? 'value',
  });
  n.addEventListener('input', () => {
    const v = parseFloat(n.value.replace(',', '.'));
    n.classList.toggle('bad', n.value.trim() !== '' && !Number.isFinite(v));
    if (Number.isFinite(v)) oninput(v);
  });
  return n;
};

const linesPanel = el('div');
function renderLines() {
  linesPanel.innerHTML = '';
  state.detected.forEach((f, i) => {
    linesPanel.append(el('div', { class: 'bench-row' }, [
      num(f, (v) => { state.detected[i] = v; rebuild(); }, { label: `detected line ${i + 1}, GHz` }),
      el('span', { class: 'bench-unit', text: 'GHz' }),
      button('×', () => { state.detected.splice(i, 1); renderLines(); rebuild(); },
        { class: 'btn small ghost', attrs: { 'aria-label': 'remove this line' } }),
    ]));
  });
  linesPanel.append(el('div', { class: 'bench-row' }, [
    button('+ line', () => {
      state.detected.push(100); renderLines(); rebuild();
    }, { class: 'btn small' }),
    button('paste a list', () => {
      const t = prompt('Observed frequencies in GHz, comma or space separated:',
        state.detected.join(', '));
      if (t == null) return;
      // "93.463, 155.772" and "93,463 155,772" are both things people paste.
      // A comma is a decimal point only when there is no period anywhere.
      const comma = !t.includes('.') && /,\d/.test(t);
      const fs = (comma ? t.split(/[;\s]+/) : t.split(/[,;\s]+/))
        .map((x) => parseFloat(comma ? x.replace(',', '.') : x))
        .filter(Number.isFinite);
      state.detected = fs; renderLines(); rebuild();
    }, { class: 'btn small ghost' }),
  ]));
}

const windowsPanel = el('div');
function renderWindows() {
  windowsPanel.innerHTML = '';
  state.windows.forEach((w, i) => {
    const kill = button('×', () => { state.windows.splice(i, 1); renderWindows(); rebuild(); },
      { class: 'btn small ghost', attrs: { 'aria-label': 'remove this window' } });
    if (w.type === 'span') {
      windowsPanel.append(el('div', { class: 'bench-row' }, [
        num(w.lo, (v) => { w.lo = v; rebuild(); }, { label: 'window lower edge, GHz' }),
        el('span', { class: 'bench-unit', text: '–' }),
        num(w.hi, (v) => { w.hi = v; rebuild(); }, { label: 'window upper edge, GHz' }),
        el('span', { class: 'bench-unit', text: 'GHz' }), kill,
      ]));
      return;
    }
    const sel = el('select', { class: 'bench-sel', 'aria-label': 'ALMA band' },
      Object.keys(ALMA_BANDS).map((b) => el('option',
        { value: b, selected: +b === w.band ? '' : null },
        [`Band ${b} · ${ALMA_BANDS[b][0]}–${ALMA_BANDS[b][1]} GHz`])));
    sel.addEventListener('change', () => { w.band = +sel.value; renderWindows(); rebuild(); });
    const spans = spansOf(w);
    const readout = el('span', { class: 'bench-unit',
      text: spans.map(([lo, hi]) => `${lo.toFixed(1)}–${hi.toFixed(1)}`).join('  +  ') });
    const s = slider({
      label: 'tuning', min: 0, max: 1, step: 0.01, value: w.ratio,
      format: (v) => v.toFixed(2),
      oninput: (v) => {
        w.ratio = v;
        const sp = spansOf(w);
        readout.textContent = sp.map(([lo, hi]) => `${lo.toFixed(1)}–${hi.toFixed(1)}`).join('  +  ');
        rebuild();
      },
    });
    windowsPanel.append(el('div', { class: 'bench-row bench-row-wide' },
      [sel, s, readout, kill]));
  });
  windowsPanel.append(el('div', { class: 'bench-row' }, [
    button('+ ALMA tuning', () => {
      state.windows.push({ type: 'alma', band: 3, ratio: 0.5 });
      renderWindows(); rebuild();
    }, { class: 'btn small' }),
    button('+ manual range', () => {
      state.windows.push({ type: 'span', lo: 90, hi: 100 });
      renderWindows(); rebuild();
    }, { class: 'btn small ghost' }),
  ]));
}

function presetSelect(label, table, apply) {
  const sel = el('select', { class: 'bench-sel', 'aria-label': label },
    [el('option', { value: '' }, [label]),
      ...Object.keys(table).map((k) => el('option', { value: k }, [k]))]);
  sel.addEventListener('change', () => {
    if (!sel.value) return;
    apply(table[sel.value]);
    sel.value = '';
  });
  return sel;
}

// --- permalink -------------------------------------------------------------

function syncHash() {
  const w = state.windows.map((x) => (x.type === 'alma'
    ? `a${x.band}:${x.ratio.toFixed(2)}`
    : `${x.lo}-${x.hi}`)).join(',');
  const parts = [
    `d=${state.detected.join(',')}`,
    `w=${w}`,
    `n=${state.nCO}`,
    `dep=${state.depth}`,
    `zr=${state.zMin}-${state.zMax}`,
    `z=${(rsg?.z ?? state.z).toFixed(3)}`,
    state.zPhot == null ? null : `p=${state.zPhot}:${state.dz}`,
    state.name === 'my source' ? null : `id=${encodeURIComponent(state.name)}`,
  ].filter(Boolean);
  history.replaceState(null, '', `#${parts.join('&')}`);
}

function readHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return;
  const q = Object.fromEntries(h.split('&').map((p) => {
    const i = p.indexOf('=');
    return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
  }));
  const nums = (s) => (s ?? '').split(',').map(parseFloat).filter(Number.isFinite);
  if (q.d !== undefined) state.detected = nums(q.d);
  if (q.w) {
    state.windows = q.w.split(',').map((tok) => {
      const alma = /^a(\d+):([\d.]+)$/.exec(tok);
      if (alma) return { type: 'alma', band: +alma[1], ratio: +alma[2] };
      const [lo, hi] = tok.split('-').map(parseFloat);
      return Number.isFinite(lo) && Number.isFinite(hi) ? { type: 'span', lo, hi } : null;
    }).filter(Boolean);
  }
  if (q.n) state.nCO = Math.max(1, Math.min(40, parseInt(q.n, 10) || 20));
  if (q.dep && DEPTH_TEXT[q.dep]) state.depth = q.dep;
  if (q.zr) {
    const [a, b] = q.zr.split('-').map(parseFloat);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) { state.zMin = a; state.zMax = b; }
  }
  if (q.z) state.z = parseFloat(q.z);
  if (q.p) {
    const [zp, dz] = q.p.split(':').map(parseFloat);
    if (Number.isFinite(zp)) { state.zPhot = zp; state.dz = Number.isFinite(dz) ? dz : 0.13; }
  }
  if (q.id) state.name = decodeURIComponent(q.id);
}

// --- assemble --------------------------------------------------------------

// Plain English is the label; the RSG.py argument name rides along in grey.
// An astronomer still recognises it at a glance; nobody else has to decode it.
function panel(title, codeName, ...children) {
  return el('section', { class: 'bench-panel' }, [
    el('h3', {}, [title, codeName ? el('span', { class: 'bench-argname', text: codeName }) : null]),
    ...children,
  ]);
}

// The worked cases, as things to attempt rather than examples to study.
function caseCards() {
  const strip = el('div', { class: 'bench-cases' });
  for (const c of CASES) {
    strip.append(el('button', {
      type: 'button', class: 'bench-case',
      onclick: () => {
        state.detected = [...c.detected];
        state.zPhot = c.zPhot;
        state.depth = c.depth;
        state.z = 0.4;
        rebuildControls();
        rebuild({ now: true });
        graphHost.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    }, [
      el('span', { class: 'bench-case-title', text: c.title }),
      el('span', { class: 'bench-case-blurb', text: c.blurb }),
    ]));
  }
  return strip;
}

const DEPTH_TEXT = {
  shallow: 'A quick look. Too shallow for a missing line to prove anything — '
    + 'so nothing here gets ruled out by silence, and you will be left with more '
    + 'answers than you want. That is the honest result of a short observation.',
  normal: 'Deep enough that a bright CO line inside a window would have been '
    + 'obvious. Its absence is evidence, and kills candidates. This is what the '
    + 'chapters assume.',
  deep: 'Deep enough to hold even the faint lines — [CI] and water — to the same '
    + 'standard. More candidates die, but only claim this if it is true.',
};

function build() {
  readHash();

  const nameInput = el('input', { type: 'text', id: 'srcname', class: 'bench-text',
    value: state.name, 'aria-label': 'source name' });
  nameInput.addEventListener('input', () => { state.name = nameInput.value; renderVerdict(); });

  // The prior's width is never typed in — it is sigma = dz(1+z), the paper's
  // rule — so it is shown, live, rather than appearing from nowhere in a verdict.
  const sigmaOut = el('span', { class: 'bench-unit' });
  const showSigma = () => {
    sigmaOut.textContent = state.zPhot == null ? ''
      : `± ${(state.dz * (1 + state.zPhot)).toFixed(2)}   (= ${state.dz} × (1 + z))`;
  };
  const zPhotToggle = el('input', { type: 'checkbox', id: 'usephotz',
    ...(state.zPhot == null ? {} : { checked: '' }) });
  const zPhotNum = num(state.zPhot ?? 3.0, (v) => { state.zPhot = v; showSigma(); rebuild(); },
    { label: 'colour guess at the redshift' });
  zPhotNum.disabled = state.zPhot == null;
  zPhotToggle.addEventListener('change', () => {
    state.zPhot = zPhotToggle.checked
      ? parseFloat(String(zPhotNum.value).replace(',', '.')) : null;
    zPhotNum.disabled = !zPhotToggle.checked;
    showSigma();
    rebuild();
  });
  showSigma();

  const depthHint = el('span', { text: DEPTH_TEXT[state.depth] });
  const depthSel = el('select', { class: 'bench-sel', id: 'depth',
    'aria-label': 'how deep was the observation' },
  ['shallow', 'normal', 'deep'].map((d) => el('option',
    { value: d, selected: d === state.depth ? '' : null },
    [{ shallow: 'a quick look', normal: 'a normal observation',
      deep: 'a deep survey' }[d]])));
  depthSel.addEventListener('change', () => {
    state.depth = depthSel.value;
    depthHint.textContent = DEPTH_TEXT[state.depth];
    rebuild();
  });

  const controls = el('div', { class: 'bench-grid' }, [
    panel('the lines you detected', 'sl_freq_obs',
      el('p', { class: 'bench-hint',
        text: 'The frequencies where you actually saw something, in GHz.' }),
      linesPanel),
    panel('where you listened', 'filter_down / filter_up',
      el('p', { class: 'bench-hint',
        text: 'Each row is one window: its bottom edge and its top edge, in GHz. '
          + 'Add an ALMA tuning instead and slide it along a band.' }),
      windowsPanel,
      el('div', { class: 'bench-row' }, [
        presetSelect('load a ready-made tuning…', TUNINGS, (t) => {
          state.windows = t.map((x) => ({ ...x }));
          renderWindows(); rebuild({ now: true });
        }),
      ])),
    panel('everything else', 'the rest of RSGplot()',
      el('div', { class: 'bench-row' }, [
        el('label', { class: 'bench-label', for: 'srcname' },
          ['source name', el('span', { class: 'bench-argname', text: 'IDname' })]),
        nameInput,
      ]),
      el('div', { class: 'bench-row' }, [
        zPhotToggle,
        el('label', { class: 'bench-label', for: 'usephotz' },
          ['colour guess at the redshift', el('span', { class: 'bench-argname', text: 'z_phot' })]),
        zPhotNum, sigmaOut,
      ]),
      el('div', { class: 'bench-row' }, [
        el('label', { class: 'bench-label', for: 'depth' },
          ['how deep was the observation?']),
        depthSel,
      ]),
      el('p', { class: 'bench-hint', id: 'depthhint' }, [depthHint]),
      el('div', { class: 'bench-row' }, [
        el('span', { class: 'bench-label' },
          ['CO rungs to draw', el('span', { class: 'bench-argname', text: 'nr_of_CO_lines' })]),
        num(state.nCO, (v) => {
          state.nCO = Math.max(1, Math.min(40, Math.round(v) || 20)); rebuild();
        }, { step: 1, min: 1, max: 40, label: 'number of CO rungs to draw' }),
      ]),
      el('div', { class: 'bench-row' }, [
        el('span', { class: 'bench-label' },
          ['redshifts to search', el('span', { class: 'bench-argname', text: 'redshift_down / _up' })]),
        num(state.zMin, (v) => { state.zMin = v; rebuild(); }, { label: 'lowest redshift to search' }),
        el('span', { class: 'bench-unit', text: '–' }),
        num(state.zMax, (v) => { state.zMax = v; rebuild(); }, { label: 'highest redshift to search' }),
      ])),
  ]);

  document.getElementById('bench').append(caseCards(), controls, graphHost, verdictNode);

  renderLines();
  renderWindows();
  rebuild({ now: true });
}

// Case cards change fields the panels own, so both lists are re-rendered.
function rebuildControls() { renderLines(); renderWindows(); }

// --- sound + chrome --------------------------------------------------------

function setupSound() {
  const btn = document.getElementById('soundbtn');
  const sync = () => {
    const on = audio.started && !audio.muted;
    btn.textContent = audio.started ? (on ? '🔊 sound on' : '⏸ sound paused') : '🔈 sound off';
    btn.setAttribute('aria-pressed', String(on));
  };
  audio.onChange(sync);
  btn.addEventListener('click', async () => {
    if (!audio.started) { await audio.start(); audio.setMuted(false); }
    else audio.toggleMute();
    sync();
  });
  sync();
}

document.getElementById('copylink')?.addEventListener('click', async (e) => {
  syncHash();
  try {
    await navigator.clipboard.writeText(location.href);
    e.target.textContent = 'link copied';
    setTimeout(() => { e.target.textContent = 'copy link'; }, 1600);
  } catch {
    e.target.textContent = location.href;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON')) return;
  if ((e.key === ' ' || e.code === 'Space') && audio.started) {
    e.preventDefault();
    audio.toggleMute();
  }
});

setupSound();
build();
