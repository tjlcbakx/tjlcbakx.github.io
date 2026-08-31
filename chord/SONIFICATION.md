# SONIFICATION.md — audio design contract

The rule that governs everything: **audio is a second rendering of the same
physics, never a sound effect pasted on.** Every tone's pitch comes from
`physics.js` line positions; if a sound can't be derived from the math, it
doesn't go in (the only exceptions are §5's UI confirmations).

## 1. The frequency map

```
f_audio [Hz] = 4 × f_obs [GHz]
```

Linear, fixed, never rescaled mid-game. Linearity is the point: the CO ladder
(115.27, 230.54, 345.80 GHz…) maps to 461, 922, 1383 Hz… — an exact harmonic
series, so a galaxy *is* a chord, and a correct redshift *sounds* like one.
The observing range of the game (~80–170 GHz) lands at 320–680 Hz, the
comfortable middle of hearing. Higher-J rungs ring in as bright overtones.

Redshift compresses all observed frequencies by (1+z); under a linear map the
chord transposes down but stays a chord. Dragging the z-slider is therefore a
true glissando of the whole universe. ("The farther away, the deeper the
song" — this is scientifically honest and emotionally right.)

## 2. Voices

| Voice | What it represents | Sound |
|---|---|---|
| **Detected line** | A line actually observed (fixed f_obs) | Steady sine + faint 2nd harmonic, gain 0.15. It never moves. It is *the data*. |
| **Model rung (CO)** | Predicted CO line in-band at candidate z | Low-passed sawtooth (cutoff 4×f), gain 0.08. Moves with the slider. |
| **Model line (atomic/faint)** | Predicted non-CO line in-band | Triangle wave, slight detune-free "bell" envelope — audibly a different *family* from CO. |
| **Ghost note** | Predicted in-band line with no detected partner (exclusion mode, Ch. 6+) | Model timbre + 6 Hz tremolo + heavy low-pass: hollow, wrong. The dog that didn't bark. |
| **Phot-z halo** | Photometric prior (Ch. 6+) | Band-filtered noise, gain ∝ exp(−Δz²/2σ²), σ = 0.13(1+z): a warm hiss that swells near z_phot. |
| **Population chorus** | Sandbox galaxies (Ch. 8) | ~12 sampled galaxies from the redshift histogram, each a quiet 2-note voice: robust → locked/consonant, ambiguous → beating, silent → absent. The *mix* is the score. |

## 3. Beats are the mechanic — and they are physical

A detected tone at f_d and a model rung at f_m sound together; when
|f_d − f_m| < ~15 Hz the ear hears beats at exactly |f_d − f_m| Hz, slowing
as the player closes in and vanishing at the match. Nothing is simulated:
the beating *is* the frequency difference, i.e. the redshift error. The
player tunes a galaxy the way a guitarist tunes a string.

Wrong-rung matches lock just as cleanly — that is the honest core of the
single-line ambiguity chapter. The game never fakes dissonance on a
mathematically valid candidate; wrong candidates are killed by *evidence*
(ghost notes, phot-z, ancillary locks), not by sounding ugly.

## 4. Visual twins (accessibility floor)

Every audio cue has a synchronized visual: beat rate → pulsing glow on the
crossing point (same Hz, capped at 12 Hz for display); lock → glow solidifies
+ arrow appears; ghost note → hollow flickering marker; phot-z halo →
soft gradient band on the z-axis; chorus mix → the stacked quality bar.
A muted player loses charm, not information. Conversely every visual state
change must be audible: the game should be playable eyes-closed by Ch. 4
(this is a test, not an aspiration — see O5 in SCOPE.md).

## 5. UI confirmations (the only non-physical sounds)

- **Lock-in**: when the player releases the slider within the capture range
  of a candidate, a short arpeggio of the *actual in-band chord at that z*
  (still physics-derived, just enveloped).
- **Exclusion**: a damped "shut door" noise burst when a candidate is
  eliminated.
- **Robust solution**: the full chord, sustained, with slow attack — used
  once per puzzle, it must feel earned.

## 6. Don't be a mosquito (Tom's rule, 2026-08-31)

Sustained pure tones are irritating; the engine is built to never drone:

- **Sound only while the player acts.** All physics voices sit behind a
  "bed" gain that ducks to silence ~2.5 s after the last interaction and
  wakes instantly on the next one (`poke()`). No interaction, no sound.
- **Warm timbres, no raw buzz.** CO voices are sawtooth low-passed at
  ~2.5 harmonics (organ-ish, not buzzy); nothing sounds above ~1.4 kHz —
  a master low-pass guarantees it. The "mosquito band" (2–5 kHz sines) is
  structurally unreachable.
- **Slow onsets.** ≥80 ms attack on every voice; nothing clicks or stabs.
- **Low levels.** Physics voices mix well below UI speech-comfort level;
  the compressor catches pile-ups. When in doubt, quieter.
- Playtest question O2 explicitly includes "did any sound annoy you?".

## 7. Mix rules

Master chain: voices → per-voice gain → master gain (0.5) → soft compressor
(threshold −18 dB) → destination. Max ~16 simultaneous voices (sandbox
chorus governs its own budget). All gain/frequency changes ramped ≥30 ms
(`setTargetAtTime`) — no zipper noise, no clicks. AudioContext resumes only
on the Ch. 0 user gesture (mobile autoplay). Mute toggle is global,
persistent (localStorage), and visible on every screen.

## 8. Fallback if beats read poorly (laptop speakers, playtest O2)

1. Widen capture: also pulse the *amplitude* of the model voice at
   |f_d − f_m| Hz when < 8 Hz (doubles the physical beat, same rate).
2. Add the visual beat indicator by default, not just for muted players.
3. Last resort: snap-to-candidate on release with an audible pitch glide
   into the lock — keeps the tuning feel, drops the fine motor demand.
