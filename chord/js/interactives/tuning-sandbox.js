// tuning-sandbox.js — Ch. 8. The player stops being the observer and becomes
// the person writing the proposal: drag the observing windows, and the whole
// population of galaxies is re-scored live with the paper's own metric
// (physics.scoreSample, in a worker). The histogram under the graph is that
// score spatially resolved — you can see *which* galaxies your tuning loses.

import { Interactive } from './base.js';
import { el, slider, button } from '../ui.js';
import { observedFreq, lineSet, coLadder, countAtZ } from '../physics.js';
import { SAMPLES } from '../data/samples.js';

const LINES = lineSet({ includeFaint: false });
const LADDER = coLadder(20);
const PAPER_BANDS = [[89.1, 112.0], [139.9, 162.7]]; // the paper's optimum
// ALMA's atmospheric windows: band 3 (3 mm) and band 4 (2 mm).
const ALMA = [{ name: 'band 3 (3 mm)', lo: 84, hi: 116 }, { name: 'band 4 (2 mm)', lo: 125, hi: 163 }];
const F_MIN = 80;
const F_MAX = 168;
const Z_MAX = 7;
const BINS = 28;

export class TuningSandbox extends Interactive {
  build() {
    // Two tunings, the paper's widths, free to sit anywhere ALMA can observe.
    // A deliberately mediocre starting point: both windows crammed into the
    // 3 mm band. It scores badly, and finding out why is the chapter.
    this.windows = [
      { lo: 84.0, width: PAPER_BANDS[0][1] - PAPER_BANDS[0][0] },
      { lo: 93.1, width: PAPER_BANDS[1][1] - PAPER_BANDS[1][0] },
    ];
    this.sample = 'herbs';
    this.best = 0;
    this.result = null;
    this.revealed = false;

    this.c = this.canvas('stage sandbox-stage');
    this.c.style.height = '400px';

    this.scoreNode = el('div', { class: 'bigscore' });
    this.bar = el('div', { class: 'scorebar' });
    this.legend = el('div', { class: 'legend', html:
      '<span><i class="sw robust"></i>robust — the redshift is nailed</span>'
      + '<span><i class="sw ambiguous"></i>ambiguous — lines, but more than one answer</span>'
      + '<span><i class="sw silent"></i>silent — no line in any window</span>' });

    this.sliders = this.windows.map((wnd, i) => slider({
      label: `window ${i + 1} &nbsp;lower edge`,
      min: F_MIN, max: F_MAX - wnd.width, step: 0.1, value: wnd.lo,
      format: (v) => `${v.toFixed(1)}–${(v + wnd.width).toFixed(1)} GHz`,
      oninput: (v) => this.moveWindow(i, v),
    }));

    this.sampleBtn = button(`sample: ${SAMPLES[this.sample].name}`, () => this.toggleSample());
    this.revealBtn = button('show the paper’s answer', () => this.reveal());

    this.root.append(
      this.c,
      this.scoreNode,
      el('div', { class: 'controls stack' }, this.sliders),
      el('div', { class: 'controls' }, [
        button('hear the population', () => this.chorus()),
        this.sampleBtn,
        this.revealBtn,
      ]),
      this.bar,
      this.legend,
    );

    this.on(this.c, 'pointerdown', (e) => this.onDown(e));
    this.on(this.c, 'pointermove', (e) => this.onMove(e));
    this.on(this.c, 'pointerup', () => { this.drag = null; });
    this.on(this.c, 'pointercancel', () => { this.drag = null; });

    this.worker = new Worker(new URL('../quality-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => this.onScore(data);
    this._cleanup.push(() => this.worker.terminate());
    this._reqId = 0;

    this.onResize();
    this.loop(() => this.draw());
    this.score();
    this.status.set('Drag the two windows. The score under the graph is the paper’s '
      + 'own metric, run live over the real survey.');
  }

  get bands() { return this.windows.map((w) => [w.lo, w.lo + w.width]); }

  onResize() {
    this.dims = this.fit(this.c);
    this._bg = null;
    this._coverage = null;
  }

  // How many lines each redshift shows through the current windows. Depends on
  // the windows, so it is rebuilt when they move — not sixty times a second.
  coverage() {
    if (this._coverage) return this._coverage;
    const N = 240;
    const bands = this.bands;
    this._coverage = Array.from({ length: N }, (_, i) => {
      const z = (i / (N - 1)) * Z_MAX;
      return countAtZ(z, LINES, bands);
    });
    return this._coverage;
  }

  // ALMA's bands, the CO ladder and the axes never move: draw them once.
  background(w, h) {
    if (this._bg && this._bg.w === w && this._bg.h === h) return this._bg.canvas;
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement('canvas');
    off.width = Math.round(w * dpr);
    off.height = Math.round(h * dpr);
    const ctx = off.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (const b of ALMA) {
      ctx.fillRect(this.pad.l, this.Y(b.hi), w - this.pad.l - this.pad.r, this.Y(b.lo) - this.Y(b.hi));
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.pad.l, this.pad.t, w - this.pad.l - this.pad.r, h - this.pad.t - this.pad.b);
    ctx.clip();
    ctx.strokeStyle = 'rgba(225,232,255,0.5)';
    ctx.lineWidth = 1;
    for (const line of LADDER) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < 200; i++) {
        const z = (i / 199) * Z_MAX;
        const f = observedFreq(line.freq, z);
        if (f < F_MIN || f > F_MAX) { started = false; continue; }
        const x = this.X(z);
        const y = this.Y(f);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    this.drawAxes(ctx, w, h);
    this._bg = { canvas: off, w, h };
    return off;
  }

  // --- geometry -------------------------------------------------------------

  X(z) { const { w } = this.dims; return this.pad.l + (z / Z_MAX) * (w - this.pad.l - this.pad.r); }
  Y(f) {
    const { h } = this.dims;
    return h - this.pad.b - ((f - F_MIN) / (F_MAX - F_MIN)) * (h - this.pad.t - this.pad.b);
  }
  fAt(py) {
    const { h } = this.dims;
    const frac = (h - this.pad.b - py) / (h - this.pad.t - this.pad.b);
    return F_MIN + frac * (F_MAX - F_MIN);
  }

  // --- interaction ----------------------------------------------------------

  onDown(e) {
    const r = this.c.getBoundingClientRect();
    const f = this.fAt(e.clientY - r.top);
    const i = this.windows.findIndex((w) => f >= w.lo - 1 && f <= w.lo + w.width + 1);
    if (i < 0) return;
    this.drag = { i, grab: f - this.windows[i].lo };
    this.c.setPointerCapture?.(e.pointerId);
  }

  onMove(e) {
    if (!this.drag) return;
    const r = this.c.getBoundingClientRect();
    const f = this.fAt(e.clientY - r.top);
    this.moveWindow(this.drag.i, f - this.drag.grab);
    this.sliders[this.drag.i].set(this.windows[this.drag.i].lo);
  }

  // A window has to fit inside one of ALMA's atmospheric windows — you cannot
  // observe across the 116–125 GHz water absorption, so a straddling window
  // snaps into the nearer band. The constraint is the lesson.
  moveWindow(i, lo) {
    const w = this.windows[i];
    const fits = ALMA.filter((b) => b.hi - b.lo >= w.width);
    const clamped = fits.map((b) => Math.min(Math.max(lo, b.lo), b.hi - w.width));
    const best = clamped.reduce((a, b) => (Math.abs(b - lo) < Math.abs(a - lo) ? b : a));
    w.lo = best;
    this._coverage = null; // the shading follows the windows; everything else is fixed
    this.poke();
    this.scoreSoon();
  }

  toggleSample() {
    this.sample = this.sample === 'herbs' ? 'spt' : 'herbs';
    this.sampleBtn.textContent = `sample: ${SAMPLES[this.sample].name}`;
    this.status.set(`Scoring against ${SAMPLES[this.sample].label}.`);
    this.score();
  }

  reveal() {
    this.revealed = true;
    PAPER_BANDS.forEach((b, i) => {
      this.windows[i].lo = b[0];
      this.windows[i].width = b[1] - b[0];
      this.sliders[i].set(b[0]);
    });
    this.score();
    this.status.cue('The paper’s answer: one window in the 3 mm band, one in the 2 mm band. '
      + 'Every good tuning has that shape — a galaxy that hides its CO ladder from one '
      + 'band shows it to the other. (Fine print: this sandbox treats a tuning as one '
      + 'clean block per band, so a block a point or two better than the paper’s exists '
      + 'here. What survives the simplification is the shape of the answer, not the '
      + 'last decimal.)');
    this.complete();
  }

  // --- scoring --------------------------------------------------------------

  scoreSoon() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.score(), 90); // one score per gesture, not per pixel
  }

  score() {
    this._reqId++;
    this.worker.postMessage({ id: this._reqId, bands: this.bands, sample: this.sample, bins: BINS, zMax: Z_MAX });
  }

  onScore(data) {
    if (data.id !== this._reqId) return; // a stale drag frame
    this.result = data;
    this.drawBar(data.fractions);
    this.best = Math.max(this.best, data.score);
    this.scoreNode.innerHTML = '';
    this.scoreNode.append(
      el('span', { class: 'score-value', text: `${(data.score * 100).toFixed(1)}` }),
      el('span', { class: 'score-unit', text: ' / 100' }),
      el('span', { class: 'score-note',
        text: `  the paper’s score: a galaxy you pin down counts 1, one with lines `
          + `but no unique answer counts ½.  best so far: ${(this.best * 100).toFixed(1)}` }),
    );
    if (!this.revealed && data.score >= 0.82) {
      this.complete('That is as good as the tuning the paper settled on. '
        + 'Now see where it put its windows — and why.');
    }
  }

  drawBar(fr) {
    this.bar.innerHTML = '';
    const parts = [
      ['robust', fr.robust], ['ambiguous', fr.ambiguous], ['silent', fr.silent],
    ];
    for (const [k, v] of parts) {
      const seg = el('div', { class: `seg ${k}`, style: { width: `${(v * 100).toFixed(1)}%` } },
        [v > 0.08 ? `${Math.round(v * 100)}%` : '']);
      seg.title = `${k}: ${(v * 100).toFixed(1)}%`;
      this.bar.append(seg);
    }
  }

  // The mix is the score (SONIFICATION.md §2): a dozen galaxies drawn across
  // the sample, each singing whatever your tuning lets it sing.
  chorus() {
    if (!this.result) return;
    this.poke();
    const zs = SAMPLES[this.sample].z;
    const picks = Array.from({ length: 12 }, (_, i) =>
      zs[Math.floor((i + 0.5) * zs.length / 12)]).sort((a, b) => a - b);
    const entries = picks.map((z) => {
      const freqs = LINES.map((l) => observedFreq(l.freq, z))
        .filter((f) => this.bands.some(([lo, hi]) => f > lo && f < hi));
      const n = freqs.length;
      const state = n === 0 ? 'silent' : n === 1 ? 'ambiguous' : 'robust';
      return { freqsGHz: freqs, state, beatHz: 5 };
    });
    const heard = entries.filter((e) => e.state !== 'silent').length;
    const pinned = entries.filter((e) => e.state === 'robust').length;
    this.audio.playChorus(entries);
    this.status.cue(`Twelve galaxies from ${SAMPLES[this.sample].name}: ${heard} sing, `
      + `${12 - heard} stay silent, and ${pinned} of the singers give you enough to pin `
      + 'them down. A silent galaxy is a night of telescope time you cannot get back.');
  }

  // --- drawing --------------------------------------------------------------

  draw() {
    if (!this.dims || this.dims.w !== this.c.clientWidth) this.onResize();
    const { ctx, w, h } = this.dims;
    this.pad = { l: 52, r: 14, t: 14, b: 104 };
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.background(w, h), 0, 0, w, h);

    // what the windows buy you, at every redshift
    const cov = this.coverage();
    const bands = this.bands;
    const dx = (this.X(Z_MAX) - this.X(0)) / (cov.length - 1);
    for (let i = 0; i < cov.length; i++) {
      const n = cov[i];
      if (!n) continue;
      ctx.fillStyle = n > 1 ? 'rgba(80,160,255,0.22)' : 'rgba(255,165,50,0.20)';
      const x0 = this.X((i / (cov.length - 1)) * Z_MAX);
      for (const [lo, hi] of bands) ctx.fillRect(x0, this.Y(hi), dx + 0.6, this.Y(lo) - this.Y(hi));
    }

    // the windows themselves — the things under the player's hands
    this.windows.forEach((wnd, i) => {
      const y0 = this.Y(wnd.lo + wnd.width);
      const y1 = this.Y(wnd.lo);
      ctx.fillStyle = 'rgba(199,146,234,0.07)';
      ctx.strokeStyle = '#c792ea';
      ctx.lineWidth = 1.5;
      ctx.fillRect(this.pad.l, y0, w - this.pad.l - this.pad.r, y1 - y0);
      ctx.strokeRect(this.pad.l, y0, w - this.pad.l - this.pad.r, y1 - y0);
      ctx.fillStyle = '#e6c8ff';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`window ${i + 1}: ${wnd.lo.toFixed(1)}–${(wnd.lo + wnd.width).toFixed(1)} GHz  (drag)`,
        this.pad.l + 8, (y0 + y1) / 2 + 4);
    });

    if (this.revealed) {
      ctx.strokeStyle = 'rgba(126,231,135,0.9)';
      ctx.setLineDash([5, 4]);
      for (const [lo, hi] of PAPER_BANDS) {
        ctx.strokeRect(this.pad.l, this.Y(hi), w - this.pad.l - this.pad.r, this.Y(lo) - this.Y(hi));
      }
      ctx.setLineDash([]);
    }

    this.drawHistogram(ctx, w, h);
  }

  // The population, binned in redshift and coloured by what your tuning does
  // to it. Same verdicts as the score bar — one computation, two pictures.
  drawHistogram(ctx, w, h) {
    const top = h - this.pad.b + 34;
    const height = 46;
    ctx.fillStyle = 'rgba(170,178,208,0.75)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${SAMPLES[this.sample].label}, and what your tuning does to it`, this.pad.l, top - 2);
    if (!this.result) return;
    const max = Math.max(...this.result.hist.map((b) => b.robust + b.ambiguous + b.silent), 1);
    const bw = (w - this.pad.l - this.pad.r) / BINS;
    this.result.hist.forEach((b, i) => {
      const x = this.pad.l + i * bw;
      let y = top + height;
      for (const [k, color] of [['silent', 'rgba(140,148,175,0.55)'],
        ['ambiguous', '#ffb554'], ['robust', '#7ee787']]) {
        const barH = (b[k] / max) * height;
        ctx.fillStyle = color;
        ctx.fillRect(x + 0.5, y - barH, bw - 1, barH);
        y -= barH;
      }
    });
  }

  drawAxes(ctx, w, h) {
    ctx.strokeStyle = '#8892b0';
    ctx.fillStyle = '#aab2d0';
    ctx.lineWidth = 1;
    ctx.font = '12px system-ui, sans-serif';
    ctx.strokeRect(this.pad.l, this.pad.t, w - this.pad.l - this.pad.r, h - this.pad.t - this.pad.b);
    ctx.textAlign = 'center';
    for (let z = 0; z <= Z_MAX; z++) {
      const x = this.X(z);
      ctx.beginPath();
      ctx.moveTo(x, h - this.pad.b);
      ctx.lineTo(x, h - this.pad.b - 5);
      ctx.stroke();
      ctx.fillText(String(z), x, h - this.pad.b + 14);
    }
    ctx.textAlign = 'right';
    for (let f = 80; f <= F_MAX; f += 20) {
      const y = this.Y(f);
      ctx.beginPath();
      ctx.moveTo(this.pad.l, y);
      ctx.lineTo(this.pad.l + 5, y);
      ctx.stroke();
      ctx.fillText(String(f), this.pad.l - 8, y + 4);
    }
    ctx.save();
    ctx.translate(13, (this.pad.t + h - this.pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('frequency [GHz]', 0, 0);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillText('redshift', (this.pad.l + w - this.pad.r) / 2, h - this.pad.b + 28);
  }
}
