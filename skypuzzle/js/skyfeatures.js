/* skyfeatures.js — what makes the whole-sky view look like the sky rather than
 * six patches floating in black: the Milky Way, 5044 stars in their real
 * colours, the constellation figures, and the names of the bright stars.
 *
 * All of it is real data baked in by scripts/export_sky.py (Hipparcos / Yale
 * BSC via d3-celestial). Nothing here is decorative: Fomalhaut really does sit
 * inside the H-ATLAS SGP footprint, and the fields really do avoid the Milky
 * Way — which is the whole reason they are where they are.
 *
 * Everything is precomputed in world coordinates at construction (world x =
 * 360 - RA, world y = Dec + 90) so a frame costs one drawImage, ~150 short
 * polylines and a bounded loop over the star arrays. Only the sky layout uses
 * this; the composite board draws none of it.
 */

import { CFG } from './config.js';

const NAME_FONT = '500 11px ui-sans-serif, system-ui, -apple-system, sans-serif';
const CONST_FONT = '500 10px ui-sans-serif, system-ui, -apple-system, sans-serif';

/**
 * Do two text boxes touch? Boxes are {x, y, w, h} with y the *baseline*, as
 * canvas fillText takes it. Labels are placed greedily in order of importance
 * — field names, then bright stars, then constellations — and any label that
 * would land on one already placed is simply dropped. On a sky this crowded
 * that is the only way to keep every name readable.
 */
function hits(a, b, pad = 3) {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad &&
         a.y - a.h < b.y + pad && b.y - b.h < a.y + pad;
}

/** Rough visual colour of a star from its B-V index, in 7 buckets. */
const BV_COLOURS = [
  [-9, 'rgb(170,196,255)'],    // O/B  hot blue
  [-0.1, 'rgb(190,210,255)'],  // B/A
  [0.15, 'rgb(215,228,255)'],  // A
  [0.35, 'rgb(246,246,250)'],  // F    white
  [0.62, 'rgb(255,242,220)'],  // G    the Sun's colour
  [0.95, 'rgb(255,222,182)'],  // K
  [1.35, 'rgb(255,196,150)'],  // M    orange-red
];

function bvBucket(bv) {
  let i = 0;
  while (i + 1 < BV_COLOURS.length && bv >= BV_COLOURS[i + 1][0]) i++;
  return i;
}

/** Screen radius in px for a star of visual magnitude `mag`. */
function starRadius(mag) {
  const t = Math.min(1, Math.max(0, (5.6 - mag) / 6.6));
  return CFG.starMinPx + (CFG.starMaxPx - CFG.starMinPx) * Math.pow(t, 1.7);
}

function starAlpha(mag) {
  return Math.min(1, Math.max(0.16, (6.5 - mag) / 5.4));
}

export class SkyFeatures {
  /**
   * @param stars  assets/sky/stars.json
   * @param consts assets/sky/constellations.json
   * @param mwImg  assets/sky/milkyway.png, already loaded
   */
  constructor(stars, consts, mwImg) {
    this.mw = mwImg;

    // --- stars, bucketed by colour so fillStyle is set 7 times a frame ---
    const n = stars.n;
    this.wx = new Float32Array(n);
    this.wy = new Float32Array(n);
    this.r = new Float32Array(n);
    this.a = new Float32Array(n);
    this.mag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.wx[i] = (360 - stars.ra[i] + 360) % 360;
      this.wy[i] = stars.dec[i] + 90;
      this.mag[i] = stars.mag[i];
      this.r[i] = starRadius(stars.mag[i]);
      this.a[i] = starAlpha(stars.mag[i]);
    }
    this.buckets = BV_COLOURS.map(() => []);
    for (let i = 0; i < n; i++) this.buckets[bvBucket(stars.bv[i])].push(i);
    this.names = stars.names.map(([i, name]) => ({ i, name, mag: stars.mag[i] }));

    // --- constellation figures, unwrapped so no segment jumps the seam ---
    this.figures = consts.lines.map((line) => {
      const pts = [];
      let prev = null;
      for (const [ra, dec] of line) {
        let x = (360 - ra + 360) % 360;
        if (prev !== null) x -= 360 * Math.round((x - prev) / 360);
        prev = x;
        pts.push(x, dec + 90);
      }
      return pts;
    });
    this.figureLabels = consts.labels
      .filter((l) => l.rank === 1)
      .map((l) => ({ name: l.name, x: (360 - l.ra + 360) % 360, y: l.dec + 90 }));
  }

  // --- behind the survey panels -------------------------------------------

  /**
   * The sky behind the panels. Returns the star-name boxes it laid out but did
   * *not* paint: names have to go on after the footprints, or a footprint
   * swallows half of them (Fomalhaut sits inside the SGP field).
   *
   * @param taken text boxes already claimed by more important labels
   */
  draw(board, ctx, taken = []) {
    const v = board.view;
    const offs = board.screenXs(0, 360);
    const yOf = (wy) => board.h / 2 - (wy - v.cy) * v.scale;
    const claimed = taken.slice();

    this._milkyWay(board, ctx, offs, yOf);
    const names = this._starNameBoxes(board, ctx, offs, yOf, v, claimed);
    if (v.scale < CFG.constMaxPxPerDeg) {
      this._figures(board, ctx, offs, yOf, v, claimed);
    }
    this._stars(board, ctx, offs, yOf, v, CFG.starMagLimit, 1, false);
    return names;
  }

  /**
   * The bright stars again, *over* the footprints and added to them, so a
   * panel reads as a window onto the same sky rather than a lid on top of it.
   */
  drawOver(board, ctx) {
    const v = board.view;
    const offs = board.screenXs(0, 360);
    const yOf = (wy) => board.h / 2 - (wy - v.cy) * v.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this._stars(board, ctx, offs, yOf, v, CFG.starOverMag, CFG.starOverAlpha, true);
    ctx.restore();
  }

  // --- pieces of the sky ---------------------------------------------------

  _milkyWay(board, ctx, offs, yOf) {
    if (!this.mw) return;
    ctx.save();
    ctx.globalAlpha = CFG.mwAlpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const wpx = 360 * board.view.scale;
    const hpx = 180 * board.view.scale;
    const yTop = yOf(180);
    for (const off of offs) ctx.drawImage(this.mw, off, yTop, wpx, hpx);
    ctx.restore();
  }

  _figures(board, ctx, offs, yOf, v, claimed) {
    // fade the figures out as you zoom in: landmarks are for finding your way
    const fade = Math.min(1, Math.max(0,
      (CFG.constMaxPxPerDeg - v.scale) / (CFG.constMaxPxPerDeg * 0.6)));
    ctx.save();
    ctx.strokeStyle = CFG.constColour;
    ctx.lineWidth = 1;
    ctx.globalAlpha = CFG.constAlpha * fade;
    for (const pts of this.figures) {
      for (const off of offs) {
        ctx.beginPath();
        for (let k = 0; k < pts.length; k += 2) {
          const x = off + pts[k] * v.scale;
          const y = yOf(pts[k + 1]);
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = CFG.constLabelAlpha * fade;
    ctx.fillStyle = CFG.constColour;
    ctx.font = CONST_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const l of this.figureLabels) {
      const y = yOf(l.y);
      if (y < -10 || y > board.h + 10) continue;
      const text = l.name.toUpperCase();
      const w = ctx.measureText(text).width;
      for (const off of offs) {
        const x = off + l.x * v.scale;
        if (x < -40 || x > board.w + 40) continue;
        const box = { x: x - w / 2, y, w, h: 10 };
        if (claimed.some((b) => hits(b, box))) continue;
        claimed.push(box);
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  }

  _stars(board, ctx, offs, yOf, v, magLimit, alphaScale, additive) {
    ctx.save();
    for (let b = 0; b < this.buckets.length; b++) {
      ctx.fillStyle = BV_COLOURS[b][1];
      for (const i of this.buckets[b]) {
        if (this.mag[i] > magLimit) continue;
        const y = yOf(this.wy[i]);
        const r = this.r[i];
        if (y + r < 0 || y - r > board.h) continue;
        ctx.globalAlpha = this.a[i] * alphaScale;
        for (const off of offs) {
          const x = off + this.wx[i] * v.scale;
          if (x + r < 0 || x - r > board.w) continue;
          if (r < 1.1) {
            ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
          } else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
          // the handful of really bright ones get a halo, as they look
          if (!additive && this.mag[i] < CFG.starGlowMag) {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r * CFG.starGlowScale);
            g.addColorStop(0, 'rgba(220,232,255,0.30)');
            g.addColorStop(1, 'rgba(220,232,255,0)');
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r * CFG.starGlowScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = BV_COLOURS[b][1];
          }
        }
      }
    }
    ctx.restore();
  }

  /**
   * Where each bright star's name can go, brightest first (this.names is in
   * magnitude order), dropping any that would sit on a label already placed.
   */
  _starNameBoxes(board, ctx, offs, yOf, v, claimed) {
    const limit = v.scale >= CFG.starNameZoomPx ? CFG.starNameMagZoom : CFG.starNameMag;
    const out = [];
    ctx.save();
    ctx.font = NAME_FONT;
    for (const s of this.names) {
      if (s.mag > limit) continue;
      const y = yOf(this.wy[s.i]) + 4;
      if (y < 12 || y > board.h) continue;
      const w = ctx.measureText(s.name).width;
      for (const off of offs) {
        const x = off + this.wx[s.i] * v.scale + 5 + this.r[s.i];
        if (x < -w || x > board.w) continue;
        const box = { text: s.name, x, y, w, h: 11 };
        if (claimed.some((b) => hits(b, box))) continue;
        claimed.push(box);
        out.push(box);
      }
    }
    ctx.restore();
    return out;
  }

  paintNames(ctx, boxes) {
    ctx.save();
    ctx.globalAlpha = CFG.starNameAlpha;
    ctx.fillStyle = 'rgb(200,214,240)';
    ctx.font = NAME_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const b of boxes) ctx.fillText(b.text, b.x, b.y);
    ctx.restore();
  }
}

/**
 * A copy of `img` fit to sit *on* the sky rather than over it:
 *
 *  - pixels darker than `cutLum` (0-255) fade out in proportion, which turns
 *    the black padding around each tilted footprint transparent, so the star
 *    field shows through instead of a black rectangle. The SPIRE maps are
 *    noisy everywhere they have data, so this only ever eats blank sky;
 *  - the rectangle's own edges are then ramped to transparent over `fx`, `fy`
 *    image pixels, so nothing ends in a hard line.
 *
 * The luminance pass needs pixel access, which a file:// page is not allowed:
 * if it throws, the feathered edges alone are still worth having.
 */
export function featherImage(img, fx, fy, cutLum = 0) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);

  if (cutLum > 0) {
    try {
      const d = g.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        // rec.601 luma is plenty here, and cheap
        const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        if (lum < cutLum) p[i + 3] = Math.round(255 * lum / cutLum);
      }
      g.putImageData(d, 0, 0);
    } catch (e) {
      // tainted canvas (file://): keep the edge ramp, skip the keying
    }
  }

  g.globalCompositeOperation = 'destination-out';
  const ramp = (x0, y0, x1, y1) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    return gr;
  };
  if (fx > 0) {
    g.fillStyle = ramp(0, 0, fx, 0);
    g.fillRect(0, 0, fx, c.height);
    g.fillStyle = ramp(c.width, 0, c.width - fx, 0);
    g.fillRect(c.width - fx, 0, fx, c.height);
  }
  if (fy > 0) {
    g.fillStyle = ramp(0, 0, 0, fy);
    g.fillRect(0, 0, c.width, fy);
    g.fillStyle = ramp(0, c.height, 0, c.height - fy);
    g.fillRect(0, c.height - fy, c.width, fy);
  }
  return c;
}
