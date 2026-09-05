/* drag.js — pointer input: board pan/zoom, and dragging a piece onto the sky.
 *
 * One code path for mouse, pen and touch (Pointer Events). The board canvas
 * has touch-action:none so the browser never steals a gesture from us; the
 * tray has touch-action:pan-x, so a horizontal swipe scrolls the tray and a
 * vertical drag pulls a piece out of it.
 */

import { CFG } from './config.js';

/** Snap radius, in board degrees, for a piece of drawn radius r_deg. */
export function snapRadius(r_deg) {
  return Math.max(CFG.snapFactor * r_deg, CFG.snapFloor);
}

/**
 * What putting `piece` down at the world point (wx, wy) means:
 * 'place' (its own position), 'near' (someone else's) or 'miss'. One test for
 * both ways of playing — the end of a drag, and a click with a piece selected.
 */
export function dropVerdict(state, layout, piece, wx, wy) {
  if (layout.dist(wx, wy, piece) < snapRadius(piece.r_deg)) return 'place';
  for (const s of state.active) {
    if (s === piece || state.placed.has(s.name)) continue;
    if (layout.dist(wx, wy, s) < CFG.nearFactor * snapRadius(s.r_deg)) return 'near';
  }
  return 'miss';
}

export class Dragger {
  /**
   * hooks: { onPlace(piece), onNearMiss(piece), onMiss(piece),
   *          onHover(fieldName|null), onDragStart(piece), onDragEnd(),
   *          onBoardTap(wx, wy), redraw() }
   */
  constructor(board, state, hooks) {
    this.board = board;
    this.state = state;
    this.hooks = hooks;
    this.pointers = new Map();     // active pointers on the board
    this.pinch = null;
    this.pan = null;
    this._bindBoard();
    this._bindWindow();
  }

  // --- board: pan, pinch, wheel zoom ---------------------------------------

  _bindBoard() {
    const c = this.board.canvas;

    c.addEventListener('pointerdown', (e) => {
      if (this.state.drag) return;
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        this.pan = null;
      } else if (this.pointers.size === 1) {
        this.pan = { x: e.clientX, y: e.clientY, moved: false };
      }
    });

    c.addEventListener('pointermove', (e) => {
      if (!this.state.drag) {
        const r = c.getBoundingClientRect();
        const [wx, wy] = this.board.toWorld(e.clientX - r.left, e.clientY - r.top);
        this.hooks.onHover(this.board.fieldAt(wx, wy), wx, wy);
      }
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch.d > 0) {
          const rect = c.getBoundingClientRect();
          const mx = (a.x + b.x) / 2 - rect.left;
          const my = (a.y + b.y) / 2 - rect.top;
          this.board.zoomAt(mx, my, d / this.pinch.d);
        }
        this.pinch.d = d;
        this.hooks.redraw();
      } else if (this.pan) {
        const dx = e.clientX - this.pan.x;
        const dy = e.clientY - this.pan.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) this.pan.moved = true;
        this.pan.x = e.clientX;
        this.pan.y = e.clientY;
        this.board.panBy(dx, dy);
        this.hooks.redraw();
      }
    });

    const end = (e, tapped) => {
      // a single pointer put down and lifted without panning is a tap on the
      // sky itself: that is how a placed galaxy is asked about again
      if (tapped && this.pointers.size === 1 && !this.pinch &&
          this.pan && !this.pan.moved && this.hooks.onBoardTap) {
        const r = c.getBoundingClientRect();
        const [wx, wy] = this.board.toWorld(e.clientX - r.left, e.clientY - r.top);
        this.hooks.onBoardTap(wx, wy);
      }
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) this.pan = null;
    };
    c.addEventListener('pointerup', (e) => end(e, true));
    c.addEventListener('pointercancel', (e) => end(e, false));
    c.addEventListener('pointerleave', () => this.hooks.onHover(null, null, null));

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 16 : 1));
      this.board.zoomAt(e.clientX - r.left, e.clientY - r.top, f);
      this.hooks.redraw();
    }, { passive: false });

    c.addEventListener('dblclick', (e) => {
      const r = c.getBoundingClientRect();
      this.board.zoomAt(e.clientX - r.left, e.clientY - r.top, 1.8);
      this.hooks.redraw();
    });
  }

  // --- piece drag -----------------------------------------------------------

  /**
   * Begin a candidate drag of `piece`. It only becomes a real drag once the
   * pointer has moved past a small threshold, so a tap still counts as a
   * selection click.
   */
  begin(piece, ev, opts) {
    if (this.state.placed.has(piece.name)) return;
    // stop the browser from starting a text selection under the drag: the
    // pointer sweeps the header and the tray captions on its way to the sky,
    // and a mouse drag would paint all of it blue
    if (ev.cancelable) ev.preventDefault();
    this.state.drag = {
      piece,
      pointerId: ev.pointerId,
      x: 0, y: 0,
      startX: ev.clientX, startY: ev.clientY,
      moved: false,
      onTap: (opts && opts.onTap) || null,
    };
    this._updateDragPos(ev);
  }

  _updateDragPos(ev) {
    const r = this.board.canvas.getBoundingClientRect();
    this.state.drag.x = ev.clientX - r.left;
    this.state.drag.y = ev.clientY - r.top;
  }

  _bindWindow() {
    window.addEventListener('pointermove', (e) => {
      const d = this.state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved &&
          Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
        d.moved = true;
        this.hooks.onDragStart(d.piece);
      }
      if (d.moved) {
        e.preventDefault();
        this._updateDragPos(e);
        this.hooks.redraw();
      }
    }, { passive: false });

    const finish = (e) => {
      const d = this.state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      const moved = d.moved;
      if (moved) this._updateDragPos(e);
      this.state.drag = null;
      if (!moved) {
        if (d.onTap) d.onTap();
      } else {
        this._drop(d, e);
        this.hooks.onDragEnd();
      }
      this.hooks.redraw();
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', (e) => {
      const d = this.state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      this.state.drag = null;
      this.hooks.onDragEnd();
      this.hooks.redraw();
    });
  }

  _drop(d, e) {
    const rect = this.board.canvas.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) { this.hooks.onMiss(d.piece); return; }

    const [wx, wy] = this.board.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const p = d.piece;
    const verdict = dropVerdict(this.state, this.board.layout, p, wx, wy);
    if (verdict === 'place') this.hooks.onPlace(p);
    else if (verdict === 'near') this.hooks.onNearMiss(p);
    else this.hooks.onMiss(p);
  }
}
