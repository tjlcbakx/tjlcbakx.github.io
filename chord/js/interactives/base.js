// base.js — the contract every chapter interactive implements:
//   mount(el, { audio, config, onComplete }) / unmount()
// The chapter engine owns the lifecycle; this base class owns the boring
// parts (canvas sizing, animation frame, teardown, the status line).

import { el, Status } from '../ui.js';

export class Interactive {
  mount(root, { audio, config = {}, onComplete = () => {} }) {
    this.root = root;
    this.audio = audio;
    this.config = config;
    this._onComplete = onComplete;
    this._done = false;
    this._frames = [];
    this._cleanup = [];
    // Nothing sounds until the player touches *this* chapter. Mounting a
    // chapter is not consent to make noise: the voices are built silent and
    // the first real interaction wakes them.
    this._quiet = true;
    this.statusNode = el('div', { class: 'status' });
    this.status = new Status(this.statusNode);
    this.build();
    this.root.appendChild(this.statusNode);
    // Mounting fills a host that may be holding open the space its previous
    // life occupied; the content defines the height from here on.
    this.root.style.minHeight = '';
    const wake = () => {
      if (!this._quiet) return;
      this._quiet = false;
      this.poke();
    };
    for (const ev of ['pointerdown', 'keydown', 'input', 'wheel']) {
      this.on(this.root, ev, wake, { passive: true });
    }
    this._resizeHandler = () => this.onResize?.();
    window.addEventListener('resize', this._resizeHandler);
    return this;
  }

  unmount() {
    // Freeze the space this interactive was taking up. Without it, a chapter
    // that scrolls out of view collapses to nothing, the document shortens,
    // and the page yanks itself out from under the reader.
    const { height } = this.root.getBoundingClientRect();
    if (height > 0) this.root.style.minHeight = `${Math.round(height)}px`;
    for (const id of this._frames) cancelAnimationFrame(id);
    this._frames = [];
    for (const fn of this._cleanup) fn();
    this._cleanup = [];
    window.removeEventListener('resize', this._resizeHandler);
    // A chapter that scrolls out of view must fall silent — the mosquito rule
    // applies at the chapter scale too (SONIFICATION.md §6) — but only if it
    // is the interactive currently making the sound; another chapter may be
    // mounted and playing.
    const mine = this.audio?.owns(this);
    this.teardown?.(mine);
    if (mine) {
      this.audio?.stopModel();
      this.audio?.clearPhotZ();
      this.audio?.stopChorus();
      this.audio?.releaseIfOwner(this);
    }
    this.root.innerHTML = '';
  }

  // Interactives call this once their teaching objective is met; the chapter
  // engine uses it to unlock the "onward" button.
  complete(message) {
    if (this._done) return;
    this._done = true;
    if (message) this.status.set(message);
    this._onComplete();
  }

  loop(fn) {
    const step = (t) => {
      fn(t);
      this._frames = [requestAnimationFrame(step)];
    };
    this._frames.push(requestAnimationFrame(step));
  }

  on(node, type, fn, opts) {
    node.addEventListener(type, fn, opts);
    this._cleanup.push(() => node.removeEventListener(type, fn, opts));
  }

  // A canvas that keeps its backing store in step with CSS pixels.
  canvas(className = 'stage', height = null) {
    const c = el('canvas', { class: className });
    if (height) c.style.height = `${height}px`;
    this._canvases = this._canvases || [];
    this._canvases.push(c);
    return c;
  }

  fit(c) {
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || 600;
    const h = c.clientHeight || 300;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // Any interaction wakes the ducked audio bed — and makes this interactive
  // the owner of the shared voices. Before the player has touched anything
  // here, it does nothing at all.
  poke() {
    if (this._quiet) return;
    this.audio?.claim(this);
    this.audio?.poke();
  }
}
