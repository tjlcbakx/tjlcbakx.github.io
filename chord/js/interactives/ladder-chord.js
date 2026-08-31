// ladder-chord.js — Ch. 2. The CO ladder as an instrument. Rungs are keys;
// plucking one sounds its observed frequency through the game's fixed map, so
// the "chord" the player hears is literally the galaxy's spectrum. The z knob
// transposes the whole thing — the same rigid factor as Ch. 1, now audible.

import { Interactive } from './base.js';
import { el, slider, button } from '../ui.js';
import { observedFreq, coLadder, ANCILLARY } from '../physics.js';
import { GHZ_TO_HZ } from '../audio.js';

// The engine's master low-pass sits at 1.4 kHz (SONIFICATION.md §6: nothing
// may ever get shrill). A line whose audio pitch is above it comes through
// muffled, and stretching the redshift brings it down into the clear — the
// honest version of "your instrument has a window", one chapter early.
const CEILING_HZ = 1400;

const RUNGS = coLadder(6);
const OFF_LADDER = ANCILLARY.filter((l) => ['[CII]158', '[CI](1-0)'].includes(l.name));

export class LadderChord extends Interactive {
  build() {
    this.z = 1;
    this.plucked = new Set();
    this.playedAll = false;
    this.flash = new Map();
    this.c = this.canvas('stage ladder-stage');
    this.c.style.height = '240px';
    const s = slider({
      label: 'redshift &nbsp;z',
      min: 0, max: 5, step: 0.01, value: 1,
      format: (v) => v.toFixed(2),
      oninput: (v) => { this.z = v; this.poke(); this.describe(); },
    });
    this.root.append(
      this.c,
      el('div', { class: 'controls' }, [
        button('play the whole chord', () => this.playAll()),
        s,
      ]),
    );
    this.on(this.c, 'pointerdown', (e) => this.onPointer(e));
    this.onResize();
    this.loop(() => this.draw());
    this.status.set('Click the rungs. Then play them together.');
  }

  onResize() { this.dims = this.fit(this.c); }

  get keys() {
    return [...RUNGS.map((l) => ({ ...l, group: 'co' })),
      ...OFF_LADDER.map((l) => ({ ...l, group: 'off' }))];
  }

  onPointer(e) {
    const r = this.c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const key = this.hit(x, y);
    if (!key) return;
    this.poke();
    this.pluck(key);
    this.plucked.add(key.name);
    if (this.plucked.size >= 3 && this.playedAll) {
      this.complete('That is a galaxy, played by hand. Onward.');
    }
  }

  pluck(key, delay = 0) {
    const f = observedFreq(key.freq, this.z);
    const hz = f * GHZ_TO_HZ;
    this.audio.pluck(f, { kind: key.group === 'co' ? 'co' : 'atomic', delay });
    this.flash.set(key.name, performance.now() + delay * 1000);
    if (delay) return;
    if (hz > CEILING_HZ) {
      this.status.cue(`${key.name}: ${f.toFixed(1)} GHz → ${hz.toFixed(0)} Hz — above the range `
        + 'this game keeps its voices in, so it arrives muffled. Stretch the redshift and '
        + 'it drops into the clear. Instruments have exactly this problem, which is why '
        + 'the next chapter gives you only two windows.');
      return;
    }
    this.status.cue(`${key.name}: ${f.toFixed(1)} GHz → ${hz.toFixed(0)} Hz`
      + (key.group === 'co' ? ` — rung ${key.J} of the ladder` : ' — off the ladder, other voice'));
  }

  playAll() {
    this.poke();
    this.playedAll = true;
    RUNGS.forEach((k, i) => this.pluck({ ...k, group: 'co' }, i * 0.09));
    this.status.cue('Six rungs at once: an overtone series. Every galaxy of this '
      + 'kind sings the same chord — only the key changes.');
    if (this.plucked.size >= 3) this.complete();
  }

  hit(x, y) {
    for (const k of this.keys) {
      const box = this._boxes?.get(k.name);
      if (box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return k;
    }
    return null;
  }

  describe() {
    const f1 = observedFreq(RUNGS[0].freq, this.z);
    this.status.set(`At z = ${this.z.toFixed(2)} the ladder starts at `
      + `${f1.toFixed(1)} GHz (${(f1 * GHZ_TO_HZ).toFixed(0)} Hz). `
      + 'Deeper — but still the same chord.');
  }

  draw() {
    if (!this.dims || this.dims.w !== this.c.clientWidth) this.onResize();
    const { ctx, w, h } = this.dims;
    ctx.clearRect(0, 0, w, h);
    const keys = this.keys;
    const pad = 12;
    const kw = (w - 2 * pad) / keys.length - 8;
    this._boxes = new Map();
    const now = performance.now();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    keys.forEach((k, i) => {
      const f = observedFreq(k.freq, this.z);
      // key height tracks pitch: the ladder's shape is visible at a glance
      const frac = Math.min(1, f / 700);
      const kh = 40 + frac * (h - 100);
      const x = pad + i * (kw + 8);
      const y = h - 46 - kh;
      const lit = (this.flash.get(k.name) ?? 0) > now - 260 && (this.flash.get(k.name) ?? 0) <= now;
      const audible = f * GHZ_TO_HZ <= CEILING_HZ;
      ctx.globalAlpha = audible ? 1 : 0.45; // out of hearing range: visibly so
      ctx.fillStyle = lit
        ? '#ffd79f'
        : k.group === 'co' ? 'rgba(225,232,255,0.16)' : 'rgba(97,174,255,0.18)';
      ctx.strokeStyle = k.group === 'co' ? 'rgba(225,232,255,0.6)' : 'rgba(97,174,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, kw, kh, 6);
      ctx.fill();
      ctx.stroke();
      this._boxes.set(k.name, { x, y, w: kw, h: kh });
      ctx.fillStyle = 'rgba(230,233,245,0.9)';
      ctx.save();
      ctx.translate(x + kw / 2, h - 30);
      ctx.fillText(k.name.replace('CO', '').replace(/[()]/g, ''), 0, 0);
      ctx.fillStyle = 'rgba(170,178,208,0.8)';
      ctx.fillText(audible ? `${f.toFixed(0)}` : `${f.toFixed(0)} ~`, 0, 14);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = 'rgba(170,178,208,0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('observed frequency [GHz] — white: CO ladder · blue: off-ladder · ~: muffled, stretch it down',
      pad, 14);
  }
}
