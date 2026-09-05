/* board.js — the map: survey panels, previews, graticule, hints, placed pieces.
 *
 * Coordinates:
 *   world   degrees, origin bottom-left, y UP   (see layout.js)
 *   screen  CSS px, origin top-left,      y DOWN
 * with  sx = (wx - view.cx) * s + W/2 ,  sy = H/2 - (wy - view.cy) * s .
 *
 * When the layout wraps (the sky view: RA is cyclic) every drawn thing is
 * emitted once per visible 360-degree copy, so panning through 0h is seamless.
 */

import { CFG } from './config.js';
import { boardCanvas, ghostCanvas } from './pieces.js';
import { galacticPlane, boardToRaDec } from './layout.js';
import { featherImage } from './skyfeatures.js';

const DEG = Math.PI / 180;
const FIELD_LABEL_FONT = '500 12px ui-sans-serif, system-ui, -apple-system, sans-serif';
const SOLVED_LABEL_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

export class Board {
  constructor(canvas, fieldsJson, images, layout, sky) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fields = fieldsJson.fields;
    this.images = images;              // field name -> HTMLImageElement
    this.sky = sky || null;            // SkyFeatures, or null: board view only
    this.feathered = new Map();        // field name -> soft-edged copy
    this.view = { cx: 0, cy: 0, scale: 1 };
    this.flashes = [];                 // {x, y, rx, ry, t0}
    this.dirty = true;
    this.setLayout(layout);
  }

  /**
   * The image to blit for a field. On the sky the footprint is ramped to
   * transparent at its edges, so it fades into the star field instead of
   * ending in a hard rectangle; on the composite board it stays exactly the
   * reference figure, hard edges and all.
   */
  panelImage(name) {
    const img = this.images[name];
    if (!img || !this.layout.wrap) return img;
    let c = this.feathered.get(name);
    if (!c) {
      const r = this.layout.panelRect(name);
      c = featherImage(img, CFG.featherDeg * img.width / r.w,
                            CFG.featherDeg * img.height / r.h, CFG.skyDarkCut);
      this.feathered.set(name, c);
    }
    return c;
  }

  setLayout(layout) {
    this.layout = layout;
    this.galactic = layout.wrap ? galacticPlane(layout, 2) : null;
    this.feathered.clear();            // the ramp is in this layout's degrees
    this.resize(true);
  }

  // --- geometry ------------------------------------------------------------

  resize(refit) {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wasFit = !refit && Math.abs(this.view.scale - (this.fit || 0)) < 1e-6;
    this.fit = Math.min(w / this.layout.w, h / this.layout.h);
    this.maxScale = Math.max(this.fit * CFG.zoomMax, CFG.maxPxPerDeg);
    if (refit || wasFit) this.reset();
    this.clamp();
    this.dirty = true;
  }

  reset() {
    this.view.scale = this.fit;
    this.view.cx = this.layout.w / 2;
    this.view.cy = this.layout.h / 2;
    this.clamp();
    this.dirty = true;
  }

  /**
   * Keep the map in view without ever freezing the pan. On an axis where the
   * map is wider than the viewport the limits are the usual "don't drag the
   * edge inside the screen"; where it is narrower they swap over and mean
   * "flush left" / "flush right", so it slides through the letterbox instead
   * of being pinned. A wrapping axis is not clamped at all.
   */
  clamp() {
    const v = this.view;
    v.scale = Math.min(Math.max(v.scale, this.fit), this.maxScale);
    const axis = (c, half, size) => {
      const m = CFG.panMargin * 2 * half;
      const lo = Math.min(half, size - half) - m;
      const hi = Math.max(half, size - half) + m;
      return Math.min(Math.max(c, lo), hi);
    };
    if (this.layout.wrap) {
      v.cx = ((v.cx % this.layout.wrap) + this.layout.wrap) % this.layout.wrap;
    } else {
      v.cx = axis(v.cx, this.w / (2 * v.scale), this.layout.w);
    }
    v.cy = axis(v.cy, this.h / (2 * v.scale), this.layout.h);
  }

  toScreen(wx, wy) {
    const v = this.view;
    return [(wx - v.cx) * v.scale + this.w / 2,
            this.h / 2 - (wy - v.cy) * v.scale];
  }

  toWorld(sx, sy) {
    const v = this.view;
    let wx = (sx - this.w / 2) / v.scale + v.cx;
    if (this.layout.wrap) {
      wx = ((wx % this.layout.wrap) + this.layout.wrap) % this.layout.wrap;
    }
    return [wx, (this.h / 2 - sy) / v.scale + v.cy];
  }

  /** Screen x of every visible copy of a world x (one, unless RA wraps). */
  screenXs(wx, widthWorld) {
    const v = this.view;
    const base = (wx - v.cx) * v.scale + this.w / 2;
    if (!this.layout.wrap) return [base];
    const period = this.layout.wrap * v.scale;
    const wpx = widthWorld * v.scale;
    const out = [];
    let x = base - Math.ceil((base + wpx) / period) * period;
    for (; x < this.w; x += period) if (x + wpx > 0) out.push(x);
    return out;
  }

  zoomAt(sx, sy, factor) {
    const v = this.view;
    const [wx, wy] = this.toWorld(sx, sy);
    const before = v.scale;
    v.scale = Math.min(Math.max(v.scale * factor, this.fit), this.maxScale);
    if (v.scale === before) return;
    v.cx = wx - (sx - this.w / 2) / v.scale;
    v.cy = wy + (sy - this.h / 2) / v.scale;
    this.clamp();
    this.dirty = true;
  }

  panBy(dxPx, dyPx) {
    const v = this.view;
    v.cx -= dxPx / v.scale;
    v.cy += dyPx / v.scale;
    this.clamp();
    this.dirty = true;
  }

  fieldAt(wx, wy) { return this.layout.fieldAt(wx, wy); }

  /** Sky position of a world point inside `field`. */
  radec(field, wx, wy) {
    return this.layout.id === 'sky'
      ? this.layout.radec(wx, wy)
      : boardToRaDec(this.fields[field], wx, wy);
  }

  flash(wx, wy, rx, ry) {
    this.flashes.push({ x: wx, y: wy, rx, ry, t0: performance.now() });
    this.dirty = true;
  }

  // --- drawing -------------------------------------------------------------

  /** Draw `img` (or run `fn`) once per visible copy of a world-space rect. */
  _tiled(wx, wy, ww, wh, fn) {
    const s = this.view.scale;
    const [, yTop] = this.toScreen(wx, wy + wh);
    const hpx = wh * s;
    if (yTop > this.h || yTop + hpx < 0) return;
    for (const x of this.screenXs(wx, ww)) fn(x, yTop, ww * s, hpx);
  }

  draw(state) {
    const ctx = this.ctx;
    const v = this.view;
    ctx.clearRect(0, 0, this.w, this.h);
    // on the board, exactly the panels' own blank sky, so there are no seams;
    // on the sky, a shade off black, which reads as night rather than as void
    ctx.fillStyle = this.layout.wrap ? CFG.skyBg : '#000';
    ctx.fillRect(0, 0, this.w, this.h);

    // the real sky first: Milky Way, stars, constellation figures. The field
    // names are laid out before it and passed in, so a star's name can dodge
    // them rather than fight them: the survey is what the player is here for.
    const fieldLabels = this.fieldLabelBoxes();
    const starNames = this.sky && this.layout.wrap
      ? this.sky.draw(this, ctx, fieldLabels) : null;
    if (this.galactic) this.drawGalacticPlane();

    // survey panels
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (CFG.bgBoost !== 1.0) ctx.filter = 'brightness(' + CFG.bgBoost + ')';
    if (this.layout.wrap) ctx.globalAlpha = CFG.skyPanelAlpha;
    for (const name in this.fields) {
      const img = this.panelImage(name);
      if (!img) continue;
      const r = this.layout.panelRect(name);
      this._tiled(r.x, r.y, r.w, r.h,
                  (x, y, w, h) => ctx.drawImage(img, x, y, w, h));
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    // ... and the bright stars again on top of the footprints, with their
    // names, which would otherwise be half-buried under a survey field
    if (this.sky && this.layout.wrap) {
      this.sky.drawOver(this, ctx);
      this.sky.paintNames(ctx, starNames);
    }

    if (state.grid) this.drawGrid();

    // faint preview of every piece that has not been found yet
    if (state.ghosts) {
      ctx.save();
      ctx.globalAlpha = CFG.ghostAlpha;
      this._eachSource(state, false, (s, x, y, rx, ry) => {
        ctx.drawImage(ghostCanvas(s), x - rx, y - ry, 2 * rx, 2 * ry);
      });
      ctx.restore();
    }

    // hint rings at every unplaced source
    if (state.hints) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 230, 190, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      this._eachSource(state, false, (s, x, y, rx, ry) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    }

    // placed pieces
    this._eachSource(state, true, (s, x, y, rx, ry) => {
      ctx.drawImage(boardCanvas(s), x - rx, y - ry, 2 * rx, 2 * ry);
    });

    // ... and the mark that says a player put them there. A placed piece and
    // the preview of an unplaced one are the same picture at two brightnesses
    // — and the player's own slider can leave the placed one the fainter of
    // the two — so brightness alone does not say which galaxies are done.
    // Four corner brackets do, without drawing over the galaxy itself; the
    // name follows once the piece is big enough on screen to carry it, which
    // at whole-sky fit scale it never is.
    ctx.save();
    ctx.strokeStyle = CFG.solvedColour;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'square';
    ctx.font = SOLVED_LABEL_FONT;
    ctx.textAlign = 'center';
    this._eachSource(state, true, (s, x, y, rx, ry) => {
      const ax = rx * CFG.solvedPad;
      const ay = ry * CFG.solvedPad;
      const arm = Math.min(ax, ay) * CFG.solvedArm;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const cx = x + sx * ax;
          const cy = y + sy * ay;
          ctx.beginPath();
          ctx.moveTo(cx - sx * arm, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy - sy * arm);
          ctx.stroke();
        }
      }
      if (rx < CFG.solvedLabelMinPx) return;
      const w = ctx.measureText(s.name).width;
      ctx.fillStyle = CFG.solvedLabelBg;
      ctx.fillRect(x - w / 2 - 3, y + ay + 3, w + 6, 14);
      ctx.fillStyle = CFG.solvedLabelColour;
      ctx.fillText(s.name, x, y + ay + 14);
    });
    ctx.restore();

    this.drawLabels(fieldLabels);

    // the piece under the cursor, at true map scale
    if (state.drag && state.drag.moved) {
      const d = state.drag;
      const [rxw, ryw] = this.layout.sourceR(d.piece);
      const rx = rxw * v.scale;
      const ry = ryw * v.scale;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(boardCanvas(d.piece), d.x - rx, d.y - ry, 2 * rx, 2 * ry);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(180, 200, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.drawFlashes();
  }

  /** Every visible copy of every placed (or unplaced) piece in the set. */
  _eachSource(state, placed, fn) {
    const s = this.view.scale;
    for (const src of state.active) {
      if (state.placed.has(src.name) !== placed) continue;
      const [wx, wy] = this.layout.sourceXY(src);
      const [rxw, ryw] = this.layout.sourceR(src);
      const rx = rxw * s;
      const ry = ryw * s;
      const [, y] = this.toScreen(wx, wy);
      if (y + ry < 0 || y - ry > this.h) continue;
      for (const x of this.screenXs(wx - rxw, 2 * rxw)) {
        if (x + 2 * rx < 0 || x > this.w) continue;
        fn(src, x + rx, y, rx, ry);
      }
    }
  }

  /** Where each visible field's name goes: {text, x, y (baseline), w, h}. */
  fieldLabelBoxes() {
    const ctx = this.ctx;
    const boxes = [];
    ctx.save();
    ctx.font = FIELD_LABEL_FONT;
    for (const name in this.fields) {
      const text = this.fields[name].label;
      const tw = ctx.measureText(text).width;
      const r = this.layout.panelRect(name);
      this._tiled(r.x, r.y, r.w, r.h, (x, y, w) => {
        if (x > this.w || x + w < 0) return;
        boxes.push({ text, w: tw, h: 12,
                     x: Math.min(Math.max(4, x), this.w - tw - 4),
                     y: Math.max(14, y - 5) });
      });
    }
    ctx.restore();
    return boxes;
  }

  drawLabels(boxes) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = FIELD_LABEL_FONT;
    ctx.fillStyle = '#9a9aa2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    for (const b of boxes) ctx.fillText(b.text, b.x, b.y);
    ctx.restore();
  }

  drawGalacticPlane() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 130, 170, ' + CFG.galacticAlpha + ')';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    for (const seg of this.galactic) {
      for (const off of this.screenXs(0, 360)) {
        ctx.beginPath();
        seg.forEach(([wx, wy], i) => {
          const y = this.toScreen(0, wy)[1];
          const x = off + wx * this.view.scale;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Finest graticule step whose lines are still at least gridMinPx apart. */
  _gridStep(perDeg) {
    const steps = CFG.gridSteps;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i] * perDeg >= CFG.gridMinPx) return steps[i];
    }
    return steps[0];
  }

  drawGrid() {
    return this.layout.id === 'sky' ? this._skyGrid() : this._panelGrid();
  }

  /** Sky view: one graticule across the whole map. */
  _skyGrid() {
    const ctx = this.ctx;
    const s = this.view.scale;
    ctx.save();
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(160, 185, 230, 0.22)';
    ctx.fillStyle = 'rgba(190, 205, 235, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 3;

    const [wxL, wyB] = this.toWorldRaw(0, this.h);
    const [wxR, wyT] = this.toWorldRaw(this.w, 0);

    const decStep = this._gridStep(s);
    for (let k = Math.ceil((wyB - 90) / decStep); k * decStep <= wyT - 90; k++) {
      const dec = k * decStep;
      if (dec < -90 || dec > 90) continue;
      const y = this.toScreen(0, dec + 90)[1];
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtSign(dec) + fmtDeg(Math.abs(dec), decStep) + '°', 6, y - 7);
    }

    const raStep = this._gridStep(s);
    for (let k = Math.ceil(wxL / raStep); k * raStep <= wxR; k++) {
      const wx = k * raStep;
      const x = (wx - this.view.cx) * s + this.w / 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const ra = ((360 - wx) % 360 + 360) % 360;
      ctx.fillText(fmtDeg(ra, raStep) + '°', x, this.h - 5);
    }
    ctx.restore();
  }

  /** World coords without the RA wrap, so grid loops can run monotonically. */
  toWorldRaw(sx, sy) {
    const v = this.view;
    return [(sx - this.w / 2) / v.scale + v.cx,
            (this.h / 2 - sy) / v.scale + v.cy];
  }

  /** Board view: a graticule clipped to each panel. */
  _panelGrid() {
    const ctx = this.ctx;
    const s = this.view.scale;
    ctx.save();
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.lineWidth = 1;

    for (const name in this.fields) {
      const f = this.fields[name];
      const [px, pTop] = this.toScreen(f.x_deg, f.y_deg + f.h_deg);
      const pw = f.w_deg * s;
      const ph = f.h_deg * s;
      if (px > this.w || pTop > this.h || px + pw < 0 || pTop + ph < 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, pTop, pw, ph);
      ctx.clip();

      const raStep = this._gridStep(f.cosd * s);
      const decStep = this._gridStep(s);
      const [raA, decA] = boardToRaDec(f, f.x_deg, f.y_deg);
      const [raB, decB] = boardToRaDec(f, f.x_deg + f.w_deg, f.y_deg + f.h_deg);

      ctx.strokeStyle = 'rgba(160, 185, 230, 0.32)';
      ctx.fillStyle = 'rgba(190, 205, 235, 0.9)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;

      for (let k = Math.ceil(Math.min(raA, raB) / raStep);
           k * raStep <= Math.max(raA, raB) + 1e-9; k++) {
        const ra = k * raStep;
        const bx = f.x_deg + f.w_deg / 2 -
                   (ra - f.ra_c - 360 * Math.round((ra - f.ra_c) / 360)) * f.cosd;
        const x = this.toScreen(bx, 0)[0];
        ctx.beginPath();
        ctx.moveTo(x, pTop);
        ctx.lineTo(x, pTop + ph);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtDeg((ra + 360) % 360, raStep) + '°', x, pTop + ph - 3);
      }
      for (let k = Math.ceil(Math.min(decA, decB) / decStep);
           k * decStep <= Math.max(decA, decB) + 1e-9; k++) {
        const dec = k * decStep;
        const by = f.y_deg + f.h_deg / 2 + (dec - f.dec_c);
        const y = this.toScreen(0, by)[1];
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px + pw, y);
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(fmtSign(dec) + fmtDeg(Math.abs(dec), decStep) + '°',
                     px + 4, y - 6);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawFlashes() {
    const ctx = this.ctx;
    const now = performance.now();
    this.flashes = this.flashes.filter((fl) => now - fl.t0 < CFG.flashMs);
    if (!this.flashes.length) return;
    ctx.save();
    for (const fl of this.flashes) {
      const t = (now - fl.t0) / CFG.flashMs;
      const grow = 1 + 0.6 * t;
      const rx = fl.rx * this.view.scale * grow;
      const ry = fl.ry * this.view.scale * grow;
      const y = this.toScreen(0, fl.y)[1];
      ctx.strokeStyle = 'rgba(150, 240, 255,' + (0.85 * (1 - t)).toFixed(3) + ')';
      ctx.lineWidth = 2.5 * (1 - t) + 0.5;
      for (const x of this.screenXs(fl.x - fl.rx, 2 * fl.rx)) {
        ctx.beginPath();
        ctx.ellipse(x + rx, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.dirty = true;
  }
}

/** Degrees, with just enough decimals for the graticule step in use. */
export function fmtDeg(v, step) {
  const dp = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toFixed(dp);
}

export function fmtSign(v) {
  return v < 0 ? '−' : '+';
}
