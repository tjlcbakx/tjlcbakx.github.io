// main.js — the chapter engine. The game is one chapter at a time: exactly
// one <section class="chapter"> is on screen, and "Onward" swaps to the next
// (Trust-style), rather than one long scroll. Each chapter's interactives are
// mounted when it is shown and unmounted when it is left, so nothing draws or
// sounds off-screen. The chapter number lives in the URL hash, so reload and
// the browser's back button both do the obvious thing.

import { SonificationEngine } from './audio.js';
import { CONFIGS } from './config.js';
import { StretchSlider } from './interactives/stretch-slider.js';
import { SpectrumStretch } from './interactives/spectrum-stretch.js';
import { LadderChord } from './interactives/ladder-chord.js';
import { RSG } from './interactives/rsg.js';
import { TuningSandbox } from './interactives/tuning-sandbox.js';

const REGISTRY = {
  'stretch-slider': StretchSlider,
  'spectrum-stretch': SpectrumStretch,
  'ladder-chord': LadderChord,
  rsg: RSG,
  'tuning-sandbox': TuningSandbox,
};

const PROGRESS_KEY = 'chord.progress';
const audio = new SonificationEngine();

class Game {
  constructor() {
    this.chapters = [...document.querySelectorAll('section.chapter')];
    this.last = this.chapters.length - 1;
    this.unlocked = Math.min(
      parseInt(localStorage.getItem(PROGRESS_KEY) ?? '0', 10) || 0, this.last,
    );
    this.mounted = new Map(); // host element -> interactive instance
    this.current = -1;
    this.setupSound();
    this.setupChapters();
    window.addEventListener('hashchange', () => this.show(this.fromHash(), { push: false }));
    this.show(this.fromHash(), { push: false });
  }

  // --- sound ---------------------------------------------------------------

  setupSound() {
    this.soundBtn = document.getElementById('soundbtn');
    const sync = () => {
      const on = audio.started && !audio.muted;
      this.soundBtn.textContent = audio.started
        ? (on ? '🔊 sound on' : '⏸ sound paused')
        : '🔈 sound off';
      this.soundBtn.title = 'space bar pauses and resumes the sound';
      this.soundBtn.setAttribute('aria-pressed', String(on));
    };
    audio.onChange(sync);
    this.soundBtn.addEventListener('click', async () => {
      if (!audio.started) { await audio.start(); audio.setMuted(false); }
      else audio.toggleMute();
      sync();
    });
    // Ch. 0's big button is the gesture that unlocks the AudioContext.
    for (const b of document.querySelectorAll('[data-action="start-audio"]')) {
      b.addEventListener('click', async () => {
        await audio.start();
        audio.setMuted(false);
        b.textContent = '🔊 sound is on';
        b.classList.add('done');
        sync();
      });
    }
    sync();
  }

  // --- chapters ------------------------------------------------------------

  setupChapters() {
    this.chapters.forEach((sec, i) => {
      const hosts = [...sec.querySelectorAll('[data-interactive]')];
      sec._hosts = hosts;
      sec._needed = hosts.filter((h) => h.dataset.optional === undefined).length;
      sec._done = 0;
      const end = sec.querySelector('.chapter-end');
      if (!end) return;
      const cont = end.querySelector('.continue');
      if (cont) {
        cont.disabled = sec._needed > 0;
        cont.addEventListener('click', () => this.advance(i));
      }
      end.querySelector('.skip')?.addEventListener('click', () => this.advance(i));
      // "back" is injected rather than repeated in the markup ten times
      if (i > 0) {
        const back = document.createElement('button');
        back.className = 'back';
        back.type = 'button';
        back.textContent = '← back';
        back.addEventListener('click', () => this.show(i - 1));
        end.prepend(back);
      }
    });
  }

  chapterComplete(sec) {
    sec._done++;
    if (sec._done >= sec._needed) {
      const cont = sec.querySelector('.continue');
      if (cont) {
        cont.disabled = false;
        cont.classList.add('ready');
      }
    }
  }

  advance(i) {
    if (i >= this.last) return;
    this.unlocked = Math.max(this.unlocked, i + 1);
    localStorage.setItem(PROGRESS_KEY, String(this.unlocked));
    this.show(i + 1);
  }

  fromHash() {
    const n = parseInt((location.hash || '').replace('#', ''), 10);
    if (Number.isNaN(n)) return Math.min(this.unlocked, this.last);
    return Math.max(0, Math.min(n, this.unlocked, this.last));
  }

  // Swap which chapter is on screen: unmount the old one's interactives,
  // mount the new one's. Nothing else is alive at any moment.
  show(i, { push = true } = {}) {
    i = Math.max(0, Math.min(i, this.unlocked, this.last));
    if (i === this.current) return;
    const old = this.chapters[this.current];
    if (old) {
      for (const h of old._hosts) this.unmount(h);
      old.classList.remove('current');
    }
    this.current = i;
    const sec = this.chapters[i];
    sec.classList.add('current');
    for (const h of sec._hosts) this.mount(h);
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (push && location.hash !== `#${i}`) history.pushState(null, '', `#${i}`);
    else if (!push) history.replaceState(null, '', `#${i}`);
    this.renderNav();
    // move keyboard focus to the new chapter so tabbing starts in the right place
    sec.setAttribute('tabindex', '-1');
    sec.focus({ preventScroll: true });
  }

  renderNav() {
    const dots = document.getElementById('progress');
    if (!dots) return;
    dots.innerHTML = '';
    this.chapters.forEach((sec, i) => {
      const d = document.createElement('button');
      d.className = `dot${i <= this.unlocked ? ' on' : ''}${i === this.current ? ' here' : ''}`;
      d.title = sec.dataset.title || `chapter ${i}`;
      d.setAttribute('aria-label', `go to: ${sec.dataset.title || i}`);
      d.setAttribute('aria-current', i === this.current ? 'step' : 'false');
      d.disabled = i > this.unlocked;
      d.addEventListener('click', () => this.show(i));
      dots.append(d);
    });
  }

  // --- mounting ------------------------------------------------------------

  mount(host) {
    if (this.mounted.has(host)) return;
    const Klass = REGISTRY[host.dataset.interactive];
    if (!Klass) { console.warn('unknown interactive', host.dataset.interactive); return; }
    const sec = host.closest('section.chapter');
    const inst = new Klass();
    try {
      inst.mount(host, {
        audio,
        config: CONFIGS[host.dataset.config] ?? {},
        onComplete: () => this.chapterComplete(sec),
      });
      this.mounted.set(host, inst);
    } catch (err) {
      console.error('failed to mount', host.dataset.interactive, err);
    }
  }

  unmount(host) {
    const inst = this.mounted.get(host);
    if (!inst) return;
    inst.unmount();
    this.mounted.delete(host);
  }
}

const game = new Game();

// A back link, but only when the player actually arrived from another page of
// this site — the same rule the Sky Puzzle uses, so the two games behave alike
// when embedded and neither shows a dead link when opened standalone.
(() => {
  const back = document.getElementById('backlink');
  if (!back) return;
  let sameSite = false;
  try {
    sameSite = !!document.referrer
      && new URL(document.referrer).origin === location.origin
      && new URL(document.referrer).pathname !== location.pathname;
  } catch { sameSite = false; }
  if (!sameSite) return;
  back.hidden = false;
  back.href = document.referrer;
  back.addEventListener('click', (e) => {
    if (history.length > 1) { e.preventDefault(); history.back(); }
  });
})();

document.getElementById('restart')?.addEventListener('click', () => {
  localStorage.removeItem(PROGRESS_KEY);
  location.hash = '#0';
  location.reload();
});

// Keyboard: left/right page through, space pauses the sound. Both stand down
// while a control has focus — the sliders want the arrows, and buttons want
// space to mean "press me".
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
  if (e.key === 'ArrowRight') game.show(game.current + 1);
  if (e.key === 'ArrowLeft') game.show(game.current - 1);
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault(); // otherwise the page jumps
    if (audio.started) audio.toggleMute();
  }
});
