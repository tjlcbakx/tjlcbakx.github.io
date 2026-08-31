/* board.js — the sky map: six Herschel/SPIRE panels, placed pieces, hints.
 *
 * Two coordinate systems:
 *   board degrees  origin bottom-left of the whole board, y UP  (the JSONs)
 *   screen CSS px  origin top-left of the canvas,          y DOWN
 * with  sx = (bx - view.cx) * s + W/2 ,  sy = H/2 - (by - view.cy) * s .
 */

import { CFG } from './config.js';
import { boardCanvas, ghostCanvas } from './pieces.js';

export class Board {
  constructor(canvas, fieldsJson, images) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.boardW = fieldsJson.board_deg[0];
    this.boardH = fieldsJson.board_deg[1];
    this.fields = fieldsJson.fields;
    this.images = images;              // field name -> HTMLImageElement
    this.view = { cx: this.boardW / 2, cy: this.boardH / 2, scale: 1 };
    this.flashes = [];                 // {x, y, r, t0}
    this.dirty = true;
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
    this.fit = Math.min(w / this.boardW, h / this.boardH);
    if (refit || wasFit) this.reset();
    this.clamp();
    this.dirty = true;
  }

  reset() {
    this.view.scale = this.fit;
    this.view.cx = this.boardW / 2;
    this.view.cy = this.boardH / 2;
    this.clamp();
    this.dirty = true;
  }

  /**
   * Keep the board in view without ever freezing the pan.
   *
   * On an axis where the board is wider than the viewport, the limits are the
   * usual "don't drag the edge inside the screen". On an axis where it is
   * *narrower* — which at fit scale is always at least one of them — the same
   * two limits simply swap over, and they then mean "flush left" and "flush
   * right": the board slides through the letterbox instead of being pinned to
   * the middle. Either way `panMargin` allows a little overshoot past that.
   */
  clamp() {
    const v = this.view;
    v.scale = Math.min(Math.max(v.scale, this.fit), this.fit * CFG.zoomMax);
    const axis = (c, half, size) => {
      const m = CFG.panMargin * 2 * half;
      const lo = Math.min(half, size - half) - m;
      const hi = Math.max(half, size - half) + m;
      return Math.min(Math.max(c, lo), hi);
    };
    v.cx = axis(v.cx, this.w / (2 * v.scale), this.boardW);
    v.cy = axis(v.cy, this.h / (2 * v.scale), this.boardH);
  }

  toScreen(bx, by) {
    const v = this.view;
    return [(bx - v.cx) * v.scale + this.w / 2,
            this.h / 2 - (by - v.cy) * v.scale];
  }

  toBoard(sx, sy) {
    const v = this.view;
    return [(sx - this.w / 2) / v.scale + v.cx,
            (this.h / 2 - sy) / v.scale + v.cy];
  }

  zoomAt(sx, sy, factor) {
    const [bx, by] = this.toBoard(sx, sy);
    const v = this.view;
    const before = v.scale;
    v.scale = Math.min(Math.max(v.scale * factor, this.fit), this.fit * CFG.zoomMax);
    if (v.scale === before) return;
    // keep the board point under the cursor fixed
    v.cx = bx - (sx - this.w / 2) / v.scale;
    v.cy = by + (sy - this.h / 2) / v.scale;
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

  /**
   * Invert export_assets.board_position(): board degrees -> sky (RA, Dec).
   * Only meaningful inside a panel; `fieldAt` says which one.
   */
  radec(field, bx, by) {
    const f = this.fields[field];
    const ra = (f.ra_c + (f.w_deg / 2 - (bx - f.x_deg)) / f.cosd + 360) % 360;
    const dec = f.dec_c + (by - f.y_deg) - f.h_deg / 2;
    return [ra, dec];
  }

  /** ... and back again. */
  boardXY(field, ra, dec) {
    const f = this.fields[field];
    let dra = ra - f.ra_c;
    dra -= 360 * Math.round(dra / 360);
    return [f.x_deg + f.w_deg / 2 - dra * f.cosd,
            f.y_deg + f.h_deg / 2 + (dec - f.dec_c)];
  }

  /** Which field panel (if any) contains this board point. */
  fieldAt(bx, by) {
    for (const name in this.fields) {
      const f = this.fields[name];
      if (bx >= f.x_deg && bx <= f.x_deg + f.w_deg &&
          by >= f.y_deg && by <= f.y_deg + f.h_deg) return name;
    }
    return null;
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
      const [raA, decA] = this.radec(name, f.x_deg, f.y_deg);
      const [raB, decB] = this.radec(name, f.x_deg + f.w_deg, f.y_deg + f.h_deg);
      const raLo = Math.min(raA, raB);
      const raHi = Math.max(raA, raB);

      ctx.strokeStyle = 'rgba(160, 185, 230, 0.32)';
      ctx.fillStyle = 'rgba(190, 205, 235, 0.9)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;

      // lines of constant RA (vertical); the panel may straddle RA = 0
      for (let k = Math.ceil(raLo / raStep); k * raStep <= raHi + 1e-9; k++) {
        const ra = k * raStep;
        const [bx] = this.boardXY(name, ra, decA);
        const [x] = this.toScreen(bx, f.y_deg);
        ctx.beginPath();
        ctx.moveTo(x, pTop);
        ctx.lineTo(x, pTop + ph);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtDeg((ra + 360) % 360, raStep) + '\u00b0',
                     x, pTop + ph - 3);
      }
      // lines of constant Dec (horizontal)
      for (let k = Math.ceil(Math.min(decA, decB) / decStep);
           k * decStep <= Math.max(decA, decB) + 1e-9; k++) {
        const dec = k * decStep;
        const [, by] = this.boardXY(name, raA, dec);
        const [, y] = this.toScreen(f.x_deg, by);
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px + pw, y);
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText((dec >= 0 ? '+' : '\u2212') +
                     fmtDeg(Math.abs(dec), decStep) + '\u00b0', px + 4, y - 6);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  flash(x, y, r) {
    this.flashes.push({ x, y, r, t0: performance.now() });
    this.dirty = true;
  }

  // --- drawing -------------------------------------------------------------

  draw(state) {
    const ctx = this.ctx;
    const v = this.view;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#000';   // exactly the panels' own blank sky: no seams
    ctx.fillRect(0, 0, this.w, this.h);

    // panels
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (CFG.bgBoost !== 1.0) ctx.filter = 'brightness(' + CFG.bgBoost + ')';
    for (const name in this.fields) {
      const f = this.fields[name];
      const img = this.images[name];
      if (!img) continue;
      const [x, yTop] = this.toScreen(f.x_deg, f.y_deg + f.h_deg);
      const w = f.w_deg * v.scale;
      const h = f.h_deg * v.scale;
      if (x > this.w || yTop > this.h || x + w < 0 || yTop + h < 0) continue;
      ctx.drawImage(img, x, yTop, w, h);
    }
    ctx.filter = 'none';

    if (state.grid) this.drawGrid();

    // faint preview of every piece that has not been found yet
    if (state.ghosts) {
      ctx.save();
      ctx.globalAlpha = CFG.ghostAlpha;
      for (const s of state.sources) {
        if (state.placed.has(s.name)) continue;   // the dragged piece keeps its
        const [x, y] = this.toScreen(s.x_deg, s.y_deg);   // preview: it is the target
        const r = s.r_deg * v.scale;
        if (x + r < 0 || y + r < 0 || x - r > this.w || y - r > this.h) continue;
        ctx.drawImage(ghostCanvas(s), x - r, y - r, 2 * r, 2 * r);
      }
      ctx.restore();
    }

    // hint circles at every *unplaced* source
    if (state.hints) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 230, 190, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      for (const s of state.sources) {
        if (state.placed.has(s.name)) continue;
        const [x, y] = this.toScreen(s.x_deg, s.y_deg);
        const r = s.r_deg * v.scale;
        if (x + r < 0 || y + r < 0 || x - r > this.w || y - r > this.h) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // placed pieces
    for (const s of state.sources) {
      if (!state.placed.has(s.name)) continue;
      const [x, y] = this.toScreen(s.x_deg, s.y_deg);
      const r = s.r_deg * v.scale;
      if (x + r < 0 || y + r < 0 || x - r > this.w || y - r > this.h) continue;
      ctx.drawImage(boardCanvas(s), x - r, y - r, 2 * r, 2 * r);
    }

    // field labels, on top of the sky, constant screen size
    ctx.save();
    ctx.font = '500 12px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#9a9aa2';
    ctx.textBaseline = 'bottom';
    for (const name in this.fields) {
      const f = this.fields[name];
      const [x, yTop] = this.toScreen(f.x_deg, f.y_deg + f.h_deg);
      const w = f.w_deg * v.scale;
      const h = f.h_deg * v.scale;
      if (x > this.w || x + w < 0 || yTop > this.h || yTop + h < 0) continue;
      ctx.fillText(f.label, Math.min(Math.max(4, x), this.w - 130),
                   Math.max(14, yTop - 5));
    }
    ctx.restore();

    // piece under the cursor, at true board scale
    if (state.drag && state.drag.moved) {
      const d = state.drag;
      const r = d.piece.r_deg * v.scale;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(boardCanvas(d.piece), d.x - r, d.y - r, 2 * r, 2 * r);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(180, 200, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // snap flashes
    const now = performance.now();
    this.flashes = this.flashes.filter((fl) => now - fl.t0 < CFG.flashMs);
    if (this.flashes.length) {
      ctx.save();
      for (const fl of this.flashes) {
        const t = (now - fl.t0) / CFG.flashMs;
        const [x, y] = this.toScreen(fl.x, fl.y);
        const r = fl.r * v.scale * (1 + 0.6 * t);
        ctx.strokeStyle = 'rgba(150, 240, 255,' + (0.85 * (1 - t)).toFixed(3) + ')';
        ctx.lineWidth = 2.5 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      this.dirty = true;
    }
  }
}


/** Degrees, with just enough decimals for the graticule step in use. */
export function fmtDeg(v, step) {
  const dp = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toFixed(dp);
}
