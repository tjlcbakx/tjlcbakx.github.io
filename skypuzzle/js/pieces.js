/* pieces.js — the ALMA cutouts: decode, stretch, colour, alpha ramp.
 *
 * The cutout PNGs are 8-bit *asinh-encoded significance maps*, not pictures:
 *
 *     A0 = asinh(sigma_lo);  A1 = asinh(sigma_hi)
 *     sigma = sinh(code/255 * (A1 - A0) + A0)
 *
 * so restretching them in the browser is a genuine re-render of the data.
 * Because the code is 8-bit, the whole chain
 *
 *     code -> sigma -> stretch(b) -> ice colormap -> alpha ramp
 *
 * collapses into a 256-entry RGBA lookup table for any slider value b. Each
 * piece therefore only has to keep its raw code bytes (Uint8Array), and a
 * re-render is a flat table copy.
 */

import { CFG } from './config.js';

let SIGTAB = null;      // Float32Array(256): code -> sigma
let ICE = null;         // Uint8Array(768): cmocean 'ice', 256 RGB triples
let SIGMA_HI = 40;

// --- asset loading ---------------------------------------------------------

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('could not load ' + src));
    im.src = src;
  });
}

const scratch = document.createElement('canvas');
const sctx = scratch.getContext('2d', { willReadFrequently: true });

function pixels(img, w, h) {
  scratch.width = w;
  scratch.height = h;
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(img, 0, 0);
  return sctx.getImageData(0, 0, w, h).data;
}

/** Grayscale cutout PNG -> raw 8-bit codes. */
export function readCodes(img) {
  const d = pixels(img, img.width, img.height);
  const n = img.width * img.height;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = d[i * 4];
  return out;
}

/** 256x1 RGB LUT image -> flat Uint8Array(768). */
export function readLut(img) {
  const d = pixels(img, 256, 1);
  const lut = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    lut[i * 3] = d[i * 4];
    lut[i * 3 + 1] = d[i * 4 + 1];
    lut[i * 3 + 2] = d[i * 4 + 2];
  }
  return lut;
}

/** Must be called once, before any piece is rendered. */
export function initDecode({ sigma_lo, sigma_hi }, lut) {
  const a0 = Math.asinh(sigma_lo);
  const a1 = Math.asinh(sigma_hi);
  SIGTAB = new Float32Array(256);
  for (let c = 0; c < 256; c++) SIGTAB[c] = Math.sinh((c / 255) * (a1 - a0) + a0);
  ICE = lut;
  SIGMA_HI = sigma_hi;
}

// --- stretch ---------------------------------------------------------------

/** Slider value b in [0,1] -> the asinh knee, in sigma. */
export function knee(b) {
  return Math.pow(10, CFG.kneeA - CFG.kneeB * b);
}

/**
 * Build the code -> RGBA table for slider value b.
 * opaque=true renders on black (tray / inspector); opaque=false applies the
 * alpha ramp so the piece sits on the sky without a square border.
 */
const mapCache = new Map();

export function buildMap(b, opaque) {
  const key = (opaque ? 'o' : 'a') + Math.round(b * 500);
  const hit = mapCache.get(key);
  if (hit) return hit;

  const k = knee(b);
  const norm = Math.asinh(SIGMA_HI / k);
  const map = new Uint8ClampedArray(1024);
  const aSpan = CFG.alphaHi - CFG.alphaLo;

  for (let c = 0; c < 256; c++) {
    const s = SIGTAB[c];
    let v = Math.asinh((s > 0 ? s : 0) / k) / norm;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const li = Math.round(v * 255) * 3;
    map[c * 4] = ICE[li];
    map[c * 4 + 1] = ICE[li + 1];
    map[c * 4 + 2] = ICE[li + 2];
    if (opaque) {
      map[c * 4 + 3] = 255;
    } else {
      let a = (v - CFG.alphaLo) / aSpan;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      map[c * 4 + 3] = Math.pow(a, CFG.alphaGamma) * 255;
    }
  }
  if (mapCache.size > 400) mapCache.clear();
  mapCache.set(key, map);
  return map;
}

// --- rendering -------------------------------------------------------------

const nativeCanvas = document.createElement('canvas');
const nctx = nativeCanvas.getContext('2d');

/** Render a piece at its native pixel size into a fresh canvas. */
function renderNative(piece, b, opaque) {
  const w = piece.px;
  const img = nctx.createImageData(w, w);
  const out = img.data;
  const map = buildMap(b, opaque);
  const codes = piece.codes;
  for (let i = 0, n = w * w; i < n; i++) {
    const m = codes[i] * 4;
    const o = i * 4;
    out[o] = map[m];
    out[o + 1] = map[m + 1];
    out[o + 2] = map[m + 2];
    out[o + 3] = map[m + 3];
  }
  nativeCanvas.width = w;
  nativeCanvas.height = w;
  nctx.putImageData(img, 0, 0);
  return nativeCanvas;
}

/**
 * Draw a piece into `canvas` at `size` CSS px (device-pixel aware).
 * opaque=false gives the board version (transparent, alpha-ramped).
 */
export function renderTo(canvas, piece, b, opaque, size) {
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(size * dpr);
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(renderNative(piece, b, opaque), 0, 0, px, px);
}

function intoCanvas(src, cache) {
  const c = cache || document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  return c;
}

/**
 * The preview ("ghost") of an unplaced piece at its true position: always at
 * the same well-developed stretch, so it shows the galaxy's shape whatever
 * the player has done to the piece's own slider.
 */
export function ghostCanvas(piece) {
  if (!piece._ghostCanvas) {
    piece._ghostCanvas = intoCanvas(renderNative(piece, CFG.ghostB, false));
  }
  return piece._ghostCanvas;
}

/**
 * The piece as it appears on the sky: native resolution, alpha ramp applied.
 * Cached on the piece and invalidated when its stretch changes.
 */
export function boardCanvas(piece) {
  if (piece._boardCanvas && piece._boardB === piece.b) return piece._boardCanvas;
  piece._boardCanvas = intoCanvas(renderNative(piece, piece.b, false),
                                  piece._boardCanvas);
  piece._boardB = piece.b;
  return piece._boardCanvas;
}
