// stretch-slider.js — Ch. 0. One wave, one tone, one idea: stretch the space
// the wave travels through and it deepens. The tone is not a sound effect —
// it is a real spectral line at 110 GHz put through physics.observedFreq and
// the game's fixed GHz→Hz map, i.e. exactly the machinery of every later
// chapter, with the graph taken away.

import { Interactive } from './base.js';
import { el, slider } from '../ui.js';
import { observedFreq } from '../physics.js';

const REST_GHZ = 110;                       // → 440 Hz at z = 0: a concert A
const ANCHOR = 70;                          // px — a trough sits here, always
const BASE_LAMBDA = 46;                     // px — one wavelength at z = 0
const LINE = [{ name: 'wave', freq: REST_GHZ, kind: 'atomic' }];
const BAND = [[1, 1000]];                   // "we can hear everything" here

export class StretchSlider extends Interactive {
  build() {
    this.z = 0;
    this.reached = false;
    const c = this.canvas('stage wave-stage');
    c.style.height = '190px';
    this.c = c;
    const s = slider({
      label: 'stretch the space &nbsp;(1 + z)',
      min: 0, max: 3, step: 0.001, value: 0,
      format: (v) => `${(1 + v).toFixed(2)}×`,
      oninput: (v) => this.setZ(v),
    });
    this.root.append(c, el('div', { class: 'controls' }, [s]));
    this.onResize();
    this.loop(() => this.draw());
  }

  onResize() { this.dims = this.fit(this.c); }

  setZ(z) {
    this.z = z;
    this.poke();
    this.audio.updateModel(z, LINE, BAND);
    const f = observedFreq(REST_GHZ, z);
    this.status.cue(`the tone is at ${(4 * f).toFixed(0)} Hz — `
      + `${(100 / (1 + z)).toFixed(0)}% of the pitch you started with`);
    if (z > 1.4 && !this.reached) {
      this.reached = true;
      this.complete();
    }
  }

  draw() {
    const { ctx, w, h } = this.fitCached();
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const stretch = 1 + this.z;
    const lambda = BASE_LAMBDA * stretch;
    const amp = h * 0.24;

    // The wave is anchored so that a trough always sits exactly on ANCHOR,
    // whatever the stretch. The ruler below therefore starts in the same place
    // every time and always spans trough to trough — the only honest way to
    // show that it is the wavelength, and not the drawing, that is changing.
    const y = (x) => mid + Math.sin(((x - ANCHOR) / lambda) * 2 * Math.PI - Math.PI / 2) * amp;

    // colour runs *redward* as it stretches — the name of the phenomenon
    const hue = 52 - 52 * Math.min(this.z / 3, 1); // yellow → red
    ctx.strokeStyle = `hsl(${hue}, 88%, ${64 - 6 * Math.min(this.z / 3, 1)}%)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      if (x === 0) ctx.moveTo(x, y(x)); else ctx.lineTo(x, y(x));
    }
    ctx.stroke();

    // the ruler: from the anchored trough to the next one
    const x0 = ANCHOR;
    const x1 = ANCHOR + lambda;
    const rulerY = mid + amp + 26;
    ctx.strokeStyle = 'rgba(230,233,245,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, rulerY);
    ctx.lineTo(Math.min(x1, w - 4), rulerY);
    ctx.stroke();
    for (const x of [x0, x1]) {
      if (x > w - 4) continue;
      ctx.beginPath();
      ctx.moveTo(x, rulerY - 5);
      ctx.lineTo(x, rulerY + 5);
      ctx.stroke();
      // a tick joining the ruler to the trough it measures
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(230,233,245,0.3)';
      ctx.beginPath();
      ctx.moveTo(x, mid + amp);
      ctx.lineTo(x, rulerY - 5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(230,233,245,0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labelX = Math.min((x0 + x1) / 2, w - 60);
    ctx.fillText(`one wavelength — ${(lambda / BASE_LAMBDA).toFixed(2)}× as long`, labelX, rulerY + 18);
  }

  fitCached() {
    if (!this.dims || this.dims.w !== this.c.clientWidth) this.onResize();
    return this.dims;
  }
}
