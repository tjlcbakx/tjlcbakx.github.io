// spectrum-stretch.js — Ch. 1. The visual twin of Ch. 0: a barcode of real
// emission lines, slid by one rigid factor. The pattern is the point — the
// player is asked to land CO(1-0) on a target, which can only be done by
// moving *everything*.

import { Interactive } from './base.js';
import { el, slider } from '../ui.js';
import { observedFreq, coLadder, CO10 } from '../physics.js';

const SHOWN = [
  ...coLadder(4),
  { name: '[CI](1-0)', freq: 492.16, kind: 'atomic' },
];
const F_MAX = 560;      // GHz — the width of this pretend spectrograph
const AUDIO_BAND = [[20, 340]]; // only sound the lines that stay warm and low
const TARGET = 57.6;    // GHz — where CO(1-0) sits at z = 1.00

export class SpectrumStretch extends Interactive {
  build() {
    this.z = 0;
    this.hit = false;
    this.c = this.canvas('stage spectrum-stage');
    this.c.style.height = '240px';
    const s = slider({
      label: 'redshift &nbsp;z',
      min: 0, max: 4, step: 0.001, value: 0,
      format: (v) => v.toFixed(2),
      oninput: (v) => this.setZ(v),
    });
    this.root.append(this.c, el('div', { class: 'controls' }, [s]));
    this.onResize();
    this.loop(() => this.draw());
    this.setZ(0);
  }

  onResize() { this.dims = this.fit(this.c); }

  setZ(z) {
    this.z = z;
    this.poke();
    this.audio.updateModel(z, SHOWN, AUDIO_BAND);
    const f = observedFreq(CO10, z);
    const off = f - TARGET;
    if (Math.abs(off) < 0.25 && !this.hit) {
      this.hit = true;
      this.audio.lockChime(z, SHOWN, AUDIO_BAND);
      this.status.cue(`CO(1-0) is on the marker at z = ${z.toFixed(2)} — and every `
        + 'other line moved with it. One factor moves the whole barcode.');
      this.complete();
    } else if (!this.hit) {
      this.status.set(`CO(1-0) is at ${f.toFixed(1)} GHz — `
        + `${off > 0 ? 'still above' : 'below'} the marker at ${TARGET} GHz.`);
    }
  }

  draw() {
    if (!this.dims || this.dims.w !== this.c.clientWidth) this.onResize();
    const { ctx, w, h } = this.dims;
    const pad = 30;
    const X = (f) => pad + (f / F_MAX) * (w - 2 * pad);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px system-ui, sans-serif';

    // Two rows: the barcode as emitted (fixed, faded) and as it arrives here.
    const rows = [
      { y: 84, z: 0, caption: 'as the galaxy emits it', alpha: 0.45, labels: false },
      { y: 186, z: this.z, caption: 'as it arrives here', alpha: 1, labels: true },
    ];
    for (const row of rows) {
      ctx.globalAlpha = row.alpha;
      ctx.fillStyle = 'rgba(170,178,208,0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(row.caption, pad, row.y - 34);
      ctx.strokeStyle = 'rgba(136,146,176,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, row.y + 16);
      ctx.lineTo(w - pad, row.y + 16);
      ctx.stroke();
      for (const line of SHOWN) {
        const f = observedFreq(line.freq, row.z);
        if (f < 2 || f > F_MAX) continue;
        const x = X(f);
        ctx.strokeStyle = line.kind === 'co' ? '#e1e8ff' : '#61aeff';
        ctx.lineWidth = line.kind === 'co' ? 2.2 : 1.6;
        ctx.beginPath();
        ctx.moveTo(x, row.y - 18);
        ctx.lineTo(x, row.y + 16);
        ctx.stroke();
        if (row.labels) {
          ctx.save();
          ctx.fillStyle = line.kind === 'co' ? 'rgba(230,233,245,0.85)' : 'rgba(97,174,255,0.95)';
          ctx.translate(x - 2, row.y - 22);
          ctx.rotate(-Math.PI / 3);
          ctx.textAlign = 'left';
          ctx.fillText(line.name, 0, 0);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }

    // the target: land CO(1-0) on it, which can only be done by moving all of it
    const tx = X(TARGET);
    ctx.strokeStyle = this.hit ? '#7ee787' : '#ffb554';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx, 160);
    ctx.lineTo(tx, 208);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = this.hit ? '#7ee787' : '#ffb554';
    ctx.textAlign = 'center';
    ctx.fillText('put CO(1-0) here', tx, 222);

    ctx.fillStyle = 'rgba(170,178,208,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText('frequency [GHz] →', w - pad, h - 6);
  }
}
