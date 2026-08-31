// graph.js — canvas renderer for the Redshift Search Graph (the game's
// central object, after the paper's Fig. 1). All positions come from
// physics.js; this file only draws.
//
// The static layer (shading, ladder curves, axes) is drawn once into an
// offscreen canvas and blitted every frame; only the cursor, candidates and
// markers are redrawn per frame.

import {
  observedFreq, inBands, countAtZ, lineSet, candidateRedshifts,
} from './physics.js';

const COLORS = {
  axis: '#8892b0',
  text: '#aab2d0',
  co: 'rgba(225, 232, 255, 0.85)',
  ancillary: 'rgba(106, 183, 255, 0.8)',
  single: 'rgba(255, 165, 50, 0.22)',
  multi: 'rgba(80, 160, 255, 0.25)',
  singleDot: '#ffb554',
  multiDot: '#61aeff',
  detected: 'rgba(255, 215, 159, 0.9)',
  cursor: '#ffffff',
  band: '#c792ea',
  ghost: '#ff7b72',
  dead: 'rgba(140, 148, 175, 0.55)',
  photz: '80, 220, 160',
};

export class RSGGraph {
  // bands: [[lo,hi],...] GHz. detected: observed line freqs (GHz).
  constructor(canvas, {
    bands, zMin = 0, zMax = 7,
    lines = lineSet({ includeFaint: true }),
    classifyLines = lineSet({ includeFaint: false }),
    fMin = null, fMax = null,
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zMin = zMin;
    this.zMax = zMax;
    this.lines = lines;
    this.classifyLines = classifyLines;
    this.candidates = [];
    this._fMinFixed = fMin;
    this._fMaxFixed = fMax;
    this.setBands(bands);
    this._resize();
  }

  // Bands can change under the player's hands in the sandbox; everything
  // derived from them (frequency window, coverage shading) refreshes here.
  setBands(bands) {
    this.bands = bands;
    const loMin = Math.min(...bands.map((b) => b[0]));
    const hiMax = Math.max(...bands.map((b) => b[1]));
    // frequency window, RSG.py style: pad below/above the outermost bands
    this.fMin = this._fMinFixed ?? loMin * 0.85;
    this.fMax = this._fMaxFixed ?? hiMax + loMin * 0.15;
    const N = 800;
    this.zGrid = Array.from({ length: N },
      (_, i) => this.zMin + (i / (N - 1)) * (this.zMax - this.zMin));
    this.coverage = this.zGrid.map((z) => countAtZ(z, this.classifyLines, bands));
    this._static = null; // invalidate the cached background
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.m = { l: 56, r: 16, t: 16, b: 44 }; // plot margins
    this._static = null;
  }

  X(z) { return this.m.l + ((z - this.zMin) / (this.zMax - this.zMin)) * (this.w - this.m.l - this.m.r); }
  Y(f) { return this.h - this.m.b - ((f - this.fMin) / (this.fMax - this.fMin)) * (this.h - this.m.t - this.m.b); }
  zAt(px) {
    const frac = (px - this.m.l) / (this.w - this.m.l - this.m.r);
    return this.zMin + Math.min(1, Math.max(0, frac)) * (this.zMax - this.zMin);
  }

  // Recompute the candidate circles for a set of detected frequencies.
  setDetected(freqs) {
    this.detected = freqs;
    this.candidates = freqs?.length
      ? candidateRedshifts(freqs, this.bands, {
          zMin: this.zMin, zMax: this.zMax,
          lines: this.lines, classifyLines: this.classifyLines,
        })
      : [];
  }

  // Nearest candidate circle to a canvas point, within `tol` pixels.
  hitTest(px, py, tol = 12) {
    let best = null;
    let bestD = tol;
    for (const c of this.candidates) {
      const d = Math.hypot(this.X(c.z) - px, this.Y(c.obsFreq) - py);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // state: {
  //   z, beatGlow: 0..1, lockedZ, found: [z...], excluded: [z...],
  //   ghosts: [{ name, obsFreq }], photz: { z, sigma }, reveal: 0..1,
  //   markers: [{ z, label, kind }]
  // }
  render(state = {}) {
    const { ctx } = this;
    if (!this.w) this._resize();
    if (state.detected && state.detected !== this._lastDetected) {
      this.setDetected(state.detected);
      this._lastDetected = state.detected;
    }
    this._drawStatic();
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.drawImage(this._static, 0, 0, this.w, this.h);
    if (state.photz) this._photzBand(state.photz);
    if (this.detected?.length) this._detectedLines(this.detected);
    this._candidates(state);
    if (state.ghosts?.length) this._ghosts(state.ghosts, state.z);
    if (state.z !== undefined) this._cursor(state.z, state.beatGlow ?? 0);
    for (const m of state.markers ?? []) this._marker(m);
    if (state.lockedZ != null) this._lockMark(state.lockedZ);
  }

  // --- the cached background ------------------------------------------------

  _drawStatic() {
    if (this._static && this._static.width === Math.round(this.w * this.dpr)) return;
    const off = document.createElement('canvas');
    off.width = Math.round(this.w * this.dpr);
    off.height = Math.round(this.h * this.dpr);
    const octx = off.getContext('2d');
    octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const real = this.ctx;
    this.ctx = octx; // draw the static parts through the same helpers
    this._shading();
    this._ladder();
    this._bandsMarker();
    this._axes();
    this.ctx = real;
    this._static = off;
  }

  _shading() {
    const { ctx } = this;
    for (const [lo, hi] of this.bands) {
      const y0 = this.Y(lo);
      const y1 = this.Y(hi);
      for (let i = 0; i < this.zGrid.length - 1; i++) {
        const c = this.coverage[i];
        if (c === 0) continue;
        ctx.fillStyle = c > 1 ? COLORS.multi : COLORS.single;
        const x0 = this.X(this.zGrid[i]);
        const x1 = this.X(this.zGrid[i + 1]);
        ctx.fillRect(x0, y1, x1 - x0 + 0.5, y0 - y1);
      }
    }
  }

  _ladder() {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.m.l, this.m.t, this.w - this.m.l - this.m.r, this.h - this.m.t - this.m.b);
    ctx.clip();
    for (const line of this.lines) {
      ctx.beginPath();
      ctx.lineWidth = 1;
      if (line.kind === 'co') {
        ctx.strokeStyle = COLORS.co;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = COLORS.ancillary;
        ctx.setLineDash([5, 4]);
      }
      let started = false;
      for (const z of this.zGrid) {
        const f = observedFreq(line.freq, z);
        if (f < this.fMin || f > this.fMax) { started = false; continue; }
        const x = this.X(z);
        const y = this.Y(f);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  _bandsMarker() {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.band;
    ctx.lineWidth = 4;
    this.bands.forEach(([lo, hi], i) => {
      const x = this.m.l - 8 - i * 7;
      ctx.beginPath();
      ctx.moveTo(x, this.Y(lo));
      ctx.lineTo(x, this.Y(hi));
      ctx.stroke();
    });
    ctx.lineWidth = 1;
  }

  _axes() {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.axis;
    ctx.fillStyle = COLORS.text;
    ctx.lineWidth = 1;
    ctx.font = '12px system-ui, sans-serif';
    ctx.strokeRect(this.m.l, this.m.t, this.w - this.m.l - this.m.r, this.h - this.m.t - this.m.b);
    ctx.textAlign = 'center';
    for (let z = Math.ceil(this.zMin); z <= this.zMax; z++) {
      const x = this.X(z);
      ctx.beginPath();
      ctx.moveTo(x, this.h - this.m.b);
      ctx.lineTo(x, this.h - this.m.b - 5);
      ctx.stroke();
      ctx.fillText(String(z), x, this.h - this.m.b + 16);
    }
    ctx.fillText('redshift  (how much the universe stretched)',
      (this.m.l + this.w - this.m.r) / 2, this.h - 8);
    // y ticks: 20 GHz steps, thinned so labels never collide at small heights
    ctx.textAlign = 'right';
    const stepGHz = (this.h - this.m.t - this.m.b) / ((this.fMax - this.fMin) / 20) < 26 ? 40 : 20;
    for (let f = Math.ceil(this.fMin / stepGHz) * stepGHz; f <= this.fMax; f += stepGHz) {
      const y = this.Y(f);
      if (y < this.m.t + 6 || y > this.h - this.m.b - 2) continue;
      ctx.beginPath();
      ctx.moveTo(this.m.l, y);
      ctx.lineTo(this.m.l + 5, y);
      ctx.stroke();
      ctx.fillText(String(f), this.m.l - 8, y + 4);
    }
    ctx.save();
    ctx.translate(13, (this.m.t + this.h - this.m.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('frequency [GHz]', 0, 0);
    ctx.restore();
  }

  // --- the live layer -------------------------------------------------------

  // The photometric prior: a warm glow on the z-axis, ±σ marked.
  // Visual twin of the phot-z hiss (SONIFICATION.md §4).
  _photzBand({ z: zp, sigma }) {
    const { ctx } = this;
    const top = this.m.t;
    const bot = this.h - this.m.b;
    const x0 = this.X(Math.max(this.zMin, zp - 3 * sigma));
    const x1 = this.X(Math.min(this.zMax, zp + 3 * sigma));
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, `rgba(${COLORS.photz}, 0)`);
    grad.addColorStop(0.5, `rgba(${COLORS.photz}, 0.20)`);
    grad.addColorStop(1, `rgba(${COLORS.photz}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x0, top, x1 - x0, bot - top);
    ctx.strokeStyle = `rgba(${COLORS.photz}, 0.5)`;
    ctx.setLineDash([3, 4]);
    for (const s of [-1, 1]) {
      const x = this.X(zp + s * sigma);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bot);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${COLORS.photz}, 0.85)`;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('photo-z', this.X(zp), bot - 6);
  }

  _detectedLines(freqs) {
    const { ctx } = this;
    for (const f of freqs) {
      const y = this.Y(f);
      ctx.strokeStyle = COLORS.detected;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.m.l, y);
      ctx.lineTo(this.w - this.m.r, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.detected;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${f.toFixed(3)} GHz`, this.m.l + 6, y - 5);
    }
  }

  // Candidate circles where detected lines cross the ladder (Fig. 1's step 4).
  _candidates(state) {
    const { ctx } = this;
    const found = state.found ?? [];
    const excluded = state.excluded ?? [];
    const near = (list, z) => list.some((v) => Math.abs(v - z) < 0.03);
    for (const c of this.candidates) {
      const x = this.X(c.z);
      const y = this.Y(c.obsFreq);
      const isDead = near(excluded, c.z);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      if (isDead) ctx.fillStyle = COLORS.dead;
      else if (c.nLines > 1) ctx.fillStyle = COLORS.multiDot;
      else if (c.nLines === 1) ctx.fillStyle = COLORS.singleDot;
      else ctx.fillStyle = 'transparent';
      if (c.nLines > 0 || isDead) ctx.fill();
      ctx.strokeStyle = isDead ? COLORS.dead : '#fff';
      ctx.lineWidth = c.nLines === 0 ? 1 : 1.5;
      ctx.stroke();
      if (isDead) { // struck through: this redshift is off the table
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y + 6);
        ctx.moveTo(x + 6, y - 6);
        ctx.lineTo(x - 6, y + 6);
        ctx.stroke();
      } else if (near(found, c.z)) { // the player has locked this one
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // Ghost notes: predicted, in band, and *not* detected. Hollow, flickering —
  // the visual twin of the tremolo'd ghost voice.
  _ghosts(ghosts, z) {
    const { ctx } = this;
    const flicker = 0.8 + 0.2 * Math.sin(performance.now() / 1000 * 2 * Math.PI * 3);
    for (const g of ghosts) {
      const x = this.X(z);
      const y = this.Y(g.obsFreq);
      ctx.save();
      ctx.globalAlpha = g.excluded ? 0.35 : flicker;
      ctx.strokeStyle = COLORS.ghost;
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(this.m.l, y);
      ctx.lineTo(this.w - this.m.r, y);
      ctx.globalAlpha *= 0.35;
      ctx.stroke();
      ctx.restore();
      if (!g.excluded) { // say out loud that this is a thing you can do
        ctx.save();
        ctx.fillStyle = COLORS.ghost;
        ctx.globalAlpha = 0.9;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('click', x + 12, y - 8);
        ctx.restore();
      }
    }
  }

  _cursor(z, beatGlow) {
    const { ctx } = this;
    const x = this.X(z);
    ctx.strokeStyle = COLORS.cursor;
    ctx.globalAlpha = 0.5 + 0.5 * beatGlow; // beat's visual twin
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, this.m.t);
    ctx.lineTo(x, this.h - this.m.b);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // An arrow + label above the plot: "a candidate lives here" (Fig. 1 step 5).
  _marker({ z, label, kind = 'candidate' }) {
    const { ctx } = this;
    const x = this.X(z);
    const y = this.m.t + 2;
    ctx.fillStyle = kind === 'dead' ? COLORS.dead
      : kind === 'solution' ? '#7ee787' : COLORS.singleDot;
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', x, y + 11);
    if (label) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(label, x, y + 24);
    }
  }

  _lockMark(z) {
    const { ctx } = this;
    const x = this.X(z);
    ctx.fillStyle = COLORS.cursor;
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', x, this.m.t + 14);
  }
}
