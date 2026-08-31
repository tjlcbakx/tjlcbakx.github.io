// rsg.js — the core component of the game: the Redshift Search Graph you can
// play. Chapters 3 to 7 are all this class with a different config; nothing
// here knows any physics of its own — candidates, coverage, ghosts and
// solutions all come from physics.js, and every tone from audio.js.
//
// config:
//   bands      [[lo,hi],…] GHz — the observing windows
//   detected   [GHz]           — the lines that were actually seen
//   mode       'count' | 'joint' | 'ab' | 'exclude' | 'case'
//   photz      { z, dz }       — the photometric prior (Ch. 6+)
//   ab         [z, z]          — the two indistinguishable solutions (Ch. 5)
//   answers    [{ label, z|null, correct, response }] — Ch. 7
//   goalCount  number          — how many candidates 'count' mode wants

import { Interactive } from './base.js';
import { el, slider, button } from '../ui.js';
import {
  lineSet, candidateRedshifts, jointSolutions, observedFreq, inBands,
} from '../physics.js';
import { RSGGraph } from '../graph.js';

const LINES = lineSet({ includeFaint: true });
const CLASSIFY = lineSet({ includeFaint: false });
const CAPTURE = 0.03;      // |Δz| that counts as "locked" when released
const SNAP = 0.06;         // release within this and the cursor glides in
const MATCH_GHZ = 0.35;    // a predicted line this close to a detection is it

export class RSG extends Interactive {
  build() {
    const cfg = this.config;
    this.bands = cfg.bands;
    this.detected = cfg.detected ?? [];
    this.mode = cfg.mode ?? 'count';
    // The bench hands in its own line set and redshift range; the chapters
    // take the defaults, which are the paper's.
    this.LINES = cfg.lines ?? LINES;
    this.CLASSIFY = cfg.classifyLines ?? CLASSIFY;
    this.zMin = cfg.zMin ?? 0;
    this.zMax = cfg.zMax ?? 7;
    this.z = cfg.startZ ?? 0.6;
    this.found = [];
    this.excluded = [];
    this.answered = false;

    this.cands = candidateRedshifts(this.detected, this.bands,
      { zMin: this.zMin, zMax: this.zMax, lines: this.LINES, classifyLines: this.CLASSIFY });
    this.solutions = this.detected.length > 1
      ? jointSolutions(this.detected, this.bands, { zMin: this.zMin, zMax: this.zMax })
      : this.cands.map((c) => ({ z: c.z, nLines: c.nLines, members: [c] }));
    // what a lock has to land on: joint solutions when there are two lines,
    // every ladder crossing when there is only one
    this.targets = this.detected.length > 1 ? this.solutions : this.cands;

    this.canvasEl = this.canvas('stage rsg-stage');
    this.canvasEl.style.height = '420px';
    this.graph = new RSGGraph(this.canvasEl, {
      bands: this.bands, zMin: this.zMin, zMax: this.zMax,
      lines: this.LINES, classifyLines: this.CLASSIFY,
    });
    this.graph.setDetected(this.detected);

    this.zSlider = slider({
      label: 'redshift &nbsp;z',
      min: this.zMin, max: this.zMax, step: 0.001, value: this.z,
      format: (v) => v.toFixed(3),
      oninput: (v) => this.setZ(v),
      onchange: () => this.release(),
    });

    const controls = el('div', { class: 'controls' }, [
      button('◀', () => this.jump(-1), { class: 'btn small', attrs: { 'aria-label': 'previous candidate redshift' } }),
      button('▶', () => this.jump(1), { class: 'btn small', attrs: { 'aria-label': 'next candidate redshift' } }),
      this.zSlider,
    ]);

    this.chips = el('div', { class: 'chips' });
    this.extra = el('div', { class: 'controls extra' });
    this.root.append(this.canvasEl, controls, this.extra, this.chips);

    this.buildMode();
    this.on(this.canvasEl, 'pointerdown', (e) => this.onPointer(e));
    this.on(this.canvasEl, 'pointermove', (e) => this.onDrag(e));
    this.on(this.canvasEl, 'pointerup', () => { this.dragging = false; this.release(); });

    if (cfg.photz) this.audio.setPhotZ(cfg.photz.z, { dz: cfg.photz.dz ?? 0.13 });

    this.t0 = performance.now();
    this.loop((t) => this.frame(t));
    this.setZ(this.z);
    this.updateProbe();
    if (this.audio.owns(this)) this.audio.setDetectedLines(this.detected);
  }

  teardown(mine) { if (mine) this.audio.stopAll(); }

  // --- per-chapter extras ---------------------------------------------------

  buildMode() {
    const cfg = this.config;
    if (this.mode === 'count') {
      this.goal = cfg.goalCount ?? Math.min(5, this.cands.length);
      this.status.set(`One line. Tune until the beating stops — then release. `
        + `Find ${this.goal} redshifts that fit.`);
    }
    if (this.mode === 'joint') {
      this.status.set('Two lines now. A redshift only counts if BOTH lock. '
        + 'Find every one that does.');
    }
    if (this.mode === 'ab') {
      const [zA, zB] = cfg.ab;
      this.extra.append(
        el('p', { class: 'task', text: 'Step 1 — hear all the fits:' }),
        button(`solution A  (z = ${zA.toFixed(2)})`, () => this.goTo(zA, 'A')),
        button(`solution B  (z = ${zB.toFixed(2)})`, () => this.goTo(zB, 'B')),
      );
      if (cfg.third) {
        this.extra.append(
          button(`solution C  (z = ${cfg.third.z.toFixed(2)})`, () => this.rejectThird()),
        );
      }
      this.extra.append(
        el('p', { class: 'task', text: 'Step 2 — now answer. Only one of these two buttons is honest:' }),
        button('commit to one of them', () => this.refuseCommit(), { class: 'btn danger' }),
        button('“I can’t tell them apart”', () => this.admit(), { class: 'btn ghost' }),
      );
      this.status.set('Listen to each fit, then answer with one of the two buttons at '
        + 'the bottom. This chapter is asking you to make a judgement, not to find a number.');
    }
    if (this.mode === 'exclude' || this.mode === 'case' || this.mode === 'free') {
      this.addProbeButton();
    }
    if (this.mode === 'exclude') {
      this.objective = el('p', { class: 'task' });
      this.extra.prepend(this.objective);
      this.updateObjective();
      this.status.set(cfg.goalExclude
        ? 'Drag to a candidate, then use the button below to point the telescope at '
          + 'the line that redshift predicts.'
        : 'Drag to the impostor redshift, then point the telescope at a line it '
          + 'predicts. Silence is the evidence.');
    }
    if (this.mode === 'case') {
      this.answers = cfg.answers ?? [];
      for (const a of this.answers) {
        this.extra.append(button(a.label, () => this.answer(a),
          { class: a.z == null ? 'btn ghost wide' : 'btn wide' }));
      }
      this.status.set(cfg.prompt ?? 'Your call.');
    }
  }

  // The keyboard twin of clicking a ghost marker: same action, reachable by
  // tab and space. Enabled only when there is actually something to point at.
  addProbeButton() {
    this.probeBtn = button('point the telescope at the predicted line', () => {
      const g = this.ghostList().find((x) => !x.excluded);
      if (g) this.probeGhost(g);
    }, { class: 'btn ghost' });
    this.probeBtn.disabled = true;
    this.extra.append(this.probeBtn);
  }

  // The chapter's objective, in words, updated as it is met. Ch. 6 was
  // unfinishable in playtesting because the player could not tell that
  // clicking was required, or how many times.
  updateObjective() {
    if (!this.objective) return;
    const cfg = this.config;
    if (cfg.goalExclude) {
      const need = cfg.goalExclude;
      const done = Math.min(this.excluded.length, need);
      const locked = this.found.some((z) => Math.abs(z - cfg.requireZ) < 0.05);
      this.objective.textContent = done < need
        ? `To do:  strike off ${need} impossible redshifts  (${done}/${need} done), `
          + `then lock the one that survives.`
        : (locked
          ? 'Done — both parts.'
          : `Struck off ${done}/${need}. Now drag to the surviving candidate and `
            + 'release to lock it in.');
      return;
    }
    const alive = this.solutions.filter(
      (s2) => !this.excluded.some((z) => Math.abs(z - s2.z) < 0.05));
    this.objective.textContent = alive.length > 1
      ? `To do:  ${alive.length} redshifts still fit (${alive.map((a) => a.z.toFixed(2)).join(' and ')}). `
        + 'Kill the impostor by pointing at a line it predicts and nobody saw.'
      : 'Done — one redshift left standing.';
  }

  // Kept in step with the redshift, not with the render loop — a backgrounded
  // tab stops painting, and a control that lies about being usable is worse
  // than one that redraws late.
  updateProbe() {
    if (!this.probeBtn) return;
    const g = this.ghostList().filter((x) => !x.excluded);
    this.probeBtn.disabled = g.length === 0;
    if (this.mode === 'free') {
      this.probeBtn.textContent = g.length
        ? `🔭 listen at ${g[0].obsFreq.toFixed(2)} GHz — this redshift predicts `
          + `${g[0].name} there, and it is not in your list`
        : 'go to a candidate redshift to check the lines it predicts';
      return;
    }
    this.probeBtn.textContent = g.length
      ? `🔭 point the telescope at ${g[0].name} (${g[0].obsFreq.toFixed(2)} GHz)`
      : 'drag to a candidate redshift to point the telescope';
  }

  // --- interaction ----------------------------------------------------------

  onPointer(e) {
    const r = this.canvasEl.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // a ghost marker under the pointer means "point the telescope here"
    const ghost = this.ghostAt(x, y);
    if (ghost) { this.probeGhost(ghost); return; }
    // with a photometric prior in play, a candidate far outside it can be
    // struck off directly — the paper's 5-sigma rule, as a click
    const cand = this.graph.hitTest(x, y);
    if (cand && this.priorRejects(cand.z)) { this.rejectByPrior(cand); return; }
    this.dragging = true;
    this.canvasEl.setPointerCapture?.(e.pointerId);
    this.setZ(this.graph.zAt(x));
    this.zSlider.set(this.z);
  }

  onDrag(e) {
    if (!this.dragging) return;
    const r = this.canvasEl.getBoundingClientRect();
    this.setZ(this.graph.zAt(e.clientX - r.left));
    this.zSlider.set(this.z);
  }

  // Keyboard/accessible traversal: hop to the next candidate crossing.
  jump(dir) {
    const zs = [...new Set(this.cands.map((c) => c.z))].sort((a, b) => a - b);
    const next = dir > 0
      ? zs.find((z) => z > this.z + 1e-3)
      : [...zs].reverse().find((z) => z < this.z - 1e-3);
    if (next == null) return;
    this.setZ(next);
    this.zSlider.set(next);
    this.release();
  }

  goTo(z, tag) {
    this.setZ(z);
    this.zSlider.set(z);
    this.audio.lockChime(z, this.LINES, this.bands);
    this.heard = this.heard || new Set();
    this.heard.add(tag);
    this.status.cue(`Solution ${tag}: z = ${z.toFixed(2)} — both detected lines lock, `
      + 'no beating, nothing left over.');
  }

  setZ(z) {
    this.z = z;
    const wasOwner = this.audio.owns(this);
    this.poke();
    if (!wasOwner) this.audio.setDetectedLines(this.detected); // taking over

    const ghosts = this.ghostNames();
    this.audio.updateModel(z, this.LINES, this.bands, { ghosts: new Set(ghosts) });
    if (this.config.photz) this.audio.updatePhotZ(z);
    this.updateProbe();
    this.updateObjective();
    if (!this.answered && this.mode !== 'ab' && this.mode !== 'case') this.describe();
  }

  describe() {
    const near = this.targets.filter((c) => Math.abs(c.z - this.z) < 0.12)
      .sort((a, b) => Math.abs(a.z - this.z) - Math.abs(b.z - this.z))[0];
    if (near) {
      const label = near.members
        ? near.members.map((m) => m.line.name).join(' + ')
        : near.line.name;
      this.status.set(`Almost: this would be ${label} at z ≈ ${near.z.toFixed(2)}. `
        + 'Release to lock it in.');
      return;
    }
    // Not at a candidate. With two detections the useful thing to say is which
    // tone has settled and which has not — "0.0 Hz" was true of one line and
    // meaningless as a summary, which is exactly how you miss that a redshift
    // has to satisfy both.
    const beats = this.detected.map((f) => ({
      f, hz: this.audio.beatRate(f, this.z, this.LINES, this.bands),
    }));
    const locked = beats.filter((b) => b.hz < 0.5);
    const loose = beats.filter((b) => b.hz >= 0.5).sort((a, b) => a.hz - b.hz);
    if (!beats.length) { this.status.set('Drag the redshift.'); return; }
    if (this.detected.length > 1 && locked.length && loose.length) {
      this.status.set(`${locked[0].f.toFixed(3)} GHz has locked — but `
        + `${loose[0].f.toFixed(3)} GHz is still beating at ${loose[0].hz.toFixed(0)} Hz. `
        + 'One line landing on a rung means nothing; a redshift has to land both.');
      return;
    }
    if (!loose.length) { // every tone quiet, no candidate: nothing in the windows
      this.status.set('No predicted line is in your windows here — silence, and '
        + 'nothing to match. Keep dragging.');
      return;
    }
    const b = loose[0];
    this.status.set(b.hz < 25
      ? `Beating at ${b.hz.toFixed(0)} Hz and slowing — you are close.`
      : 'Nothing lines up here. Keep dragging.');
  }

  // Release = commit. Snap in if we are close (SONIFICATION.md §8 fallback 3),
  // so fine motor control is never the puzzle.
  release() {
    const hit = this.targets
      .filter((c) => Math.abs(c.z - this.z) < SNAP)
      .sort((a, b) => Math.abs(a.z - this.z) - Math.abs(b.z - this.z))[0];
    if (!hit) return;
    const snapped = Math.abs(hit.z - this.z) > CAPTURE;
    this.setZ(hit.z);
    this.zSlider.set(hit.z);
    this.lock(hit, snapped);
  }

  lock(hit, snapped) {
    const already = this.found.some((z) => Math.abs(z - hit.z) < 0.03);
    if (!already) this.found.push(hit.z);
    const label = hit.members
      ? hit.members.map((m) => m.line.name).join(' + ')
      : hit.line.name;
    this.audio.lockChime(hit.z, this.LINES, this.bands);
    if (!already) {
      this.chips.append(el('span', { class: 'chip' },
        [`${label} → z = ${hit.z.toFixed(2)}`]));
    }
    const nLines = hit.nLines ?? hit.members?.[0]?.nLines ?? 1;
    this.updateObjective();
    this.status.cue(`${snapped ? 'Snapped in. ' : ''}Locked: ${label} ⇒ z = ${hit.z.toFixed(2)}`
      + (this.detected.length > 1
        ? ' — both detected lines agree here.'
        : (nLines > 1
          ? ' — and a second line should be visible at this redshift. Is it?'
          : ' — one line, one guess among many.')));
    this.checkGoal();
  }

  checkGoal() {
    if (this.mode === 'count' && this.found.length >= this.goal) {
      this.complete(`${this.found.length} redshifts, all of them perfectly good fits. `
        + 'That is the problem with one line.');
    }
    if (this.mode === 'joint' && this.found.length >= this.solutions.length) {
      this.audio.robustChord(this.found[0], this.LINES, this.bands);
      this.status.cue(`Both survivors found: z = ${this.found.map((z) => z.toFixed(2)).join(' and ')}. `
        + 'Two lines killed almost everything — but not quite everything.');
      this.complete();
    }
    if (this.mode === 'exclude') this.checkExclusion();
  }

  // --- ghosts: the lines that should be there and aren't --------------------

  // Which lines does redshift z put in a window with no detection to match
  // them? That set *is* the exclusion argument, and it is the same test
  // wherever the game makes it.
  predictedButUndetected(z, { includeFaint = false } = {}) {
    const out = [];
    for (const line of this.LINES) {
      // §2.3.2: [CI] and H2O are only evidence in a survey deep enough to have
      // seen them. The chapters assume a normal-depth survey and skip them.
      if (line.kind === 'faint' && !includeFaint) continue;
      const f = observedFreq(line.freq, z);
      if (!inBands(f, this.bands)) continue;
      if (this.detected.some((d) => Math.abs(d - f) < MATCH_GHZ)) continue;
      out.push({ name: line.name, obsFreq: f });
    }
    return out;
  }

  // Which line each detection would be, if z were the answer.
  identify(z) {
    return this.detected.map((d) => {
      const hit = this.LINES.find((l) => Math.abs(observedFreq(l.freq, z) - d) < MATCH_GHZ);
      return hit ? hit.name : `${d.toFixed(3)} GHz`;
    });
  }

  // At the current redshift, the ghosts the player can point a telescope at.
  ghostNames() {
    if (!(this.mode === 'exclude' || this.mode === 'case' || this.mode === 'free')) return [];
    const atCandidate = this.targets.some((c) => Math.abs(c.z - this.z) < CAPTURE);
    if (!atCandidate) return [];
    return this.predictedButUndetected(this.z).map((g) => g.name);
  }

  ghostList() {
    const dead = this.excluded.some((z) => Math.abs(z - this.z) < 0.03);
    return this.ghostNames().map((name) => {
      const line = this.LINES.find((l) => l.name === name);
      return { name, obsFreq: observedFreq(line.freq, this.z), excluded: dead };
    });
  }

  ghostAt(px, py) {
    for (const g of this.ghostList()) {
      if (Math.hypot(this.graph.X(this.z) - px, this.graph.Y(g.obsFreq) - py) < 14) return g;
    }
    return null;
  }

  // Pointing the telescope at a predicted-but-absent line. Silence is data.
  probeGhost(ghost) {
    this.poke();
    const z = this.z;
    if (this.excluded.some((e) => Math.abs(e - z) < 0.03)) return;
    this.excluded.push(z);
    this.audio.exclusionThud();
    this.audio.updateModel(z, this.LINES, this.bands,
      { ghosts: new Set(this.ghostNames()), silent: new Set([ghost.name]) });
    this.updateProbe();
    this.updateObjective();
    this.status.cue(`Nothing at ${ghost.obsFreq.toFixed(2)} GHz. A galaxy at z = ${z.toFixed(2)} `
      + `would be singing ${ghost.name} right there, loudly. It isn't. `
      + 'This redshift is dead.');
    this.checkExclusion();
  }

  // The paper's prior: dz/(1+z) = 0.13, and a candidate more than 5 sigma from
  // the photometric redshift is not believed.
  priorRejects(z) {
    const p = this.config.photz;
    if (!p || (this.mode !== 'exclude' && this.mode !== 'case')) return false;
    const sigma = (p.dz ?? 0.13) * (1 + p.z);
    return Math.abs(z - p.z) > 5 * sigma;
  }

  rejectByPrior(cand) {
    this.poke();
    if (this.excluded.some((e) => Math.abs(e - cand.z) < 0.03)) return;
    this.excluded.push(cand.z);
    this.audio.exclusionThud();
    const p = this.config.photz;
    const sigma = (p.dz ?? 0.13) * (1 + p.z);
    this.updateProbe();
    this.updateObjective();
    this.status.cue(`z = ${cand.z.toFixed(2)} is ${(Math.abs(cand.z - p.z) / sigma).toFixed(1)} `
      + `sigma from the photometric redshift of ${p.z.toFixed(1)}. `
      + 'The colours of the dust would have to be badly wrong. Struck off.');
    this.checkExclusion();
  }

  checkExclusion() {
    if (this.mode !== 'exclude') return;
    // A guided exclusion drill (Ch. 6b): clear enough impostors, then commit.
    if (this.config.goalExclude) {
      const need = this.config.goalExclude;
      const locked = this.found.some(
        (z) => Math.abs(z - this.config.requireZ) < 0.05);
      if (this.excluded.length >= need && locked) {
        this.audio.robustChord(this.config.requireZ, this.LINES, this.bands);
        this.status.cue(`z = ${this.config.requireZ.toFixed(2)} survives: it is inside the `
          + 'photometric prior, and it is the identification that predicts nothing '
          + 'you failed to see. One line, one answer — if you are careful.');
        this.complete();
      } else if (!locked) {
        this.status.set(`${this.excluded.length} candidate(s) struck off. `
          + `${this.excluded.length >= need ? 'Now lock the one that survives.' : 'Keep going.'}`);
      }
      return;
    }
    const alive = this.solutions.filter(
      (s) => !this.excluded.some((z) => Math.abs(z - s.z) < 0.05));
    if (this.solutions.length > 1 && alive.length === 1) {
      this.audio.robustChord(alive[0].z, this.LINES, this.bands);
      this.status.cue(`One survivor: z = ${alive[0].z.toFixed(2)}. `
        + 'The impostor was killed by a line that wasn’t there.');
      this.complete();
    }
  }

  // The third fit of the Fig. 4 galaxy is *not* like the other two: it demands
  // lines nobody saw. Killing it here is the whole point — it shows the player
  // what a real refutation looks like, so that the silence at A and B lands as
  // "no evidence", not "not looked yet".
  rejectThird() {
    const t = this.config.third;
    this.goTo(t.z, 'C');
    const missing = this.predictedButUndetected(t.z);
    if (!this.excluded.some((z) => Math.abs(z - t.z) < 0.05)) this.excluded.push(t.z);
    this.audio.exclusionThud();
    this.status.cue(`z = ${t.z.toFixed(2)} fits both detections as well — `
      + `${this.identify(t.z).join(' and ')} — but it also demands `
      + `${missing.map((m) => `${m.name} at ${m.obsFreq.toFixed(2)} GHz`).join(' and ')}, `
      + 'inside your windows, and there is nothing there. That is what killing a '
      + 'redshift looks like, and it is exactly what you cannot do to A or B.');
  }

  // --- Ch. 5: the honest refusal -------------------------------------------

  refuseCommit() {
    this.poke();
    const heard = this.heard?.size ?? 0;
    this.status.set(heard < 2
      ? 'Listen to both first. You owe them that.'
      : 'On what evidence? Both fits are exact. Both use real CO transitions. '
        + 'Nothing you have heard distinguishes them — and publishing one as '
        + 'certain would be a guess wearing a lab coat.');
  }

  admit() {
    this.poke();
    const heard = this.heard?.size ?? 0;
    if (heard < 2) {
      this.status.set('Hear them first — the claim only means something once you '
        + 'have listened to both.');
      return;
    }
    this.audio.lockChime(this.config.ab[0], this.LINES, this.bands);
    this.complete('Correct. Two exact fits, nothing in the data between them '
      + (this.config.third ? '(unlike the third one, which the missing lines killed). ' : '. ')
      + 'Now let’s go and get some evidence.');
  }

  // --- Ch. 7: the cases -----------------------------------------------------

  answer(a) {
    this.poke();
    if (a.correct) {
      this.answered = true;
      if (a.z != null) {
        this.setZ(a.z);
        this.zSlider.set(a.z);
        this.audio.robustChord(a.z, this.LINES, this.bands);
      } else {
        this.audio.lockChime(this.z, this.LINES, this.bands);
        this.root.classList.add('celebrate');
      }
      this.status.cue(a.response);
      this.complete();
    } else {
      this.audio.exclusionThud();
      this.status.set(a.response);
    }
  }

  // --- frame ---------------------------------------------------------------

  beatHz() {
    if (!this.detected.length) return Infinity;
    return Math.min(...this.detected.map(
      (f) => this.audio.beatRate(f, this.z, this.LINES, this.bands)));
  }

  frame(t) {
    const beat = this.beatHz();
    let glow = 0;
    if (beat < 15) {
      const rate = Math.max(beat, 0.5);
      glow = 0.5 + 0.5 * Math.sin(2 * Math.PI * Math.min(rate, 12) * ((t - this.t0) / 1000));
      if (beat < 0.5) glow = 1; // locked: solid
    }
    const markers = [];
    if (this.config.showSolutions) {
      for (const s of this.solutions) {
        const dead = this.excluded.some((z) => Math.abs(z - s.z) < 0.05);
        markers.push({ z: s.z, label: s.z.toFixed(2), kind: dead ? 'dead' : 'solution' });
      }
    }
    this.graph.render({
      z: this.z,
      detected: this.detected,
      beatGlow: glow,
      found: this.found,
      excluded: this.excluded,
      ghosts: this.ghostList(),
      photz: this.config.photz
        ? { z: this.config.photz.z, sigma: (this.config.photz.dz ?? 0.13) * (1 + this.config.photz.z) }
        : null,
      markers,
    });
  }

  onResize() { this.graph._resize(); }
}
