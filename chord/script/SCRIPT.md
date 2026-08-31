# SCRIPT.md — narrative text, draft 1

> **Superseded as the source of truth (2026-08-31).** The shipped copy now
> lives in `game/index.html`; edit it there. This file is kept as the design
> draft — it records the intended beat of each chapter, which is still the
> thing to check a rewrite against. Where the two differ, the built game wins
> (e.g. Ch. 3's "seven candidate redshifts" is thirteen in the real tuning).

Chapter-by-chapter prose for the game. Voice: warm, second person, Nicky Case
register. Text in `>` blocks is player-visible copy; *(stage directions)* are
build notes for the interactive. Keep sentences short on screen; the fold-out
asides carry the caveats. Scientific content must stay true to Bakx &
Dannerbauer (2022) — when in doubt, the paper wins over the joke.

---

## Ch. 0 — Turn your sound on

> **This game makes sound.** Not decoration — the sound *is* the science.
> Put on headphones if you can.
>
> *(button: 🔊 I'm ready)*

*(The button is the user gesture that unlocks the AudioContext. On click, a
single warm tone fades in.)*

> Hear that? That's a wave. Light is one too.
> Now stretch the space it travels through:
>
> *(interactive: `stretch-slider` — a drawn sine wave the player stretches;
> the tone drops as it stretches. No numbers yet.)*
>
> Longer wave, deeper note. Astronomers call this **redshift**.
> The universe has been doing this to starlight for 13.8 billion years.

## Ch. 1 — Everything is running away

> Galaxies far away aren't sitting still. Space itself grows, and the light
> crossing it grows with it. The farther the galaxy, the more its light has
> stretched by the time it reaches us.
>
> Here's the useful part: light from a galaxy isn't a smooth hum. Atoms and
> molecules glow at *exact* frequencies — a barcode, identical in every
> galaxy.
>
> *(interactive: `spectrum-stretch` — a spectrum with a few labelled emission
> lines; dragging z slides them all together, in lock-step.)*
>
> Stretch it. Notice what does NOT change: the *pattern*. Every line moves by
> the same factor. That factor is (1 + z), and z is the redshift.
>
> So if we can recognize even part of the barcode, we can read off z — and
> with it, the distance, the epoch, everything.

*(fold-out: "why not just use a ruler?" — one paragraph on why distances are
hard and redshift is the currency of cosmology.)*

## Ch. 2 — The galaxy is a chord

> The galaxies in this game are monsters: dusty factories making stars a
> thousand times faster than the Milky Way. So dusty that visible light
> barely escapes. But their cold gas glows in the radio — carbon monoxide,
> of all things — and it glows at a *ladder* of frequencies:
>
> 115 GHz. 231. 346. 461… every rung an (almost) exact multiple of the first.
>
> *(interactive: `ladder-chord` — piano-like rungs; tap to pluck each; a
> "play all" button sounds the chord; a z-knob transposes it downward.)*
>
> Multiples of one frequency — a musician would say *overtones*. A galaxy's
> cold gas is literally a chord. Stretch it with redshift and it stays a
> chord, just deeper.
>
> And a few other atoms sing off-ladder notes with a different voice —
> ionized carbon, water. Remember their timbre. They'll save you later.

*(fold-out: "is the ladder really exact?" — CO rotational levels, the linear
spacing, and that the approximation is good to what matters here.)*

## Ch. 3 — You are a radio telescope

> Congratulations. You are now a millimetre-wave observatory in the Chilean
> desert. Budget cuts: you may listen to TWO narrow frequency windows.
> The galaxy's chord is out there somewhere — but stretched by an unknown z.
>
> *(the RSG builds up piece by piece: axes → ladder curves → band shading →
> the detected line appears with a ping.)*
>
> A line! A real detection, at 155.772 GHz. One steady tone.
> But which rung of the ladder is it?
>
> *(interactive: `rsg-single-line` — the prototype. Player tunes z, beats
> lock at every crossing. A counter tallies locked candidates.)*
>
> You found… seven perfectly good redshifts. One tone fits many rungs.
> This single number could mean a galaxy 4 billion years old, or 12.
> We need another note.

## Ch. 4 — Two notes are (almost) a song

> Your second window catches something: 93.463 GHz. Two steady tones now.
> A candidate redshift must lock BOTH — the whole chord shifts together,
> remember?
>
> *(interactive: `rsg-two-line` — same component, second detected line;
> arrows appear above the graph where candidates lock; most die.)*
>
> Feel the difference: nearly everywhere, one tone locks and the other
> beats angrily. Except… there. z = 2.70. CO(3-2) and CO(5-4). Locked.
> The chord fits. *(lock fanfare — the earned one)*
>
> …and also there. z ≈ 6.4. Locked too. Huh.

## Ch. 5 — The impostor

> Here's the dirty secret of ladders: they're *too* regular.
> If rung 3 and rung 5 fit at one redshift, then somewhere deeper there's a
> redshift where the same two tones are rungs 6 and 10. Multiply the whole
> ladder by two, stretch space to compensate — identical music.
>
> *(interactive: `rsg-degenerate` — the Fig. 4 pair, 107.229 & 160.844 GHz.
> A/B buttons flip between z=1.15 and z=3.30; the player is invited to hear
> ANY difference. There is none. A "commit" button exists and the game
> gently refuses to let honesty commit.)*
>
> Both solutions are perfect. The universe is not going to tell you which.
> An astronomer who publishes one of these as certain is *guessing* —
> and this exact trap is why redshift papers have erratum sections.
>
> So how do we break a perfect tie? We cheat. Three ways. Next chapter.

*(fold-out: the GCD rule — when transitions share a common factor, the
degenerate twin exists; eq. 1 of the paper drawn as ladder spacing.)*

## Ch. 6 — Listen for the silence

> **Cheat #1: the dog that didn't bark.**
> The z = 6.4 impostor from Ch. 4 doesn't just predict your two detected
> lines. It predicts MORE lines — at 109.04 and 140.195 GHz, inside your
> windows. Point there. Listen.
>
> *(interactive: `rsg-exclusion` — at the impostor z, ghost notes flutter,
> hollow, at the predicted-but-absent frequencies; clicking one plays the
> "exclusion" door-shut and the candidate greys out.)*
>
> Nothing. A healthy galaxy at z = 6.4 would be singing there. Silence is
> data: the impostor dies. z = 2.70 stands alone. *(full chord, sustained)*
>
> **Cheat #2: a rough guess is still a guess.**
> Before pointing a single antenna, we photograph these galaxies in other
> light. Dust colors give a fuzzy redshift — z ≈ 3, give or take a lot.
> Useless for precision. Perfect for tie-breaking: a candidate at z = 0.6
> when the fuzz says 3? Gone.
> *(the phot-z halo appears: a warm glow on the z-axis; the noise-band
> swells as the cursor crosses it.)*
>
> **Cheat #3: the off-ladder note.**
> Remember the atoms with a different voice? They're not on the CO ladder,
> so the multiply-everything trick fails on them. One off-ladder note
> locking with one CO note kills every ladder impostor at once.
> *(a [CI] line locks with a CO line; degenerate candidates collapse.)*

*(fold-out: "when can you NOT trust the silence?" — the paper's §2.3.2:
faint lines, depth, and why [CI] needs a deep survey.)*

## Ch. 7 — Three real galaxies

> Enough training. Three real observations. The full toolkit. Go.
>
> **Galaxy A** — two lines, 93.463 & 155.772 GHz. *(the Fig. 1 case:
> answer z = 2.70, impostor at 6.4 dies by ghost notes.)*
>
> **Galaxy B** — ONE loud line, 144.089 GHz, and a fuzzy photo-z ≈ 3.
> *(the Fig. 3 case: z = 3.00, the z = 0.6 twin dies by photo-z, others by
> silence. Teaches single-line robustness.)*
>
> **Galaxy C** — two lines, 107.229 & 160.844 GHz, photo-z ≈ 2.3, fuzz
> covering both candidates. *(the Fig. 4 case. The RIGHT answer is the
> third button: "request more telescope time." The game celebrates this
> as a win — the only celebration in Ch. 7 with confetti.)*
>
> That third answer is the most important thing this game teaches.
> Real astronomers say "we don't know yet" for a living.

## Ch. 8 — Design the search

> Final promotion: you're not the observer anymore. You're the one WRITING
> the telescope proposal. Thousands of dusty galaxies are waiting; you
> choose the frequency windows everyone else will listen through.
>
> *(interactive: `tuning-sandbox` — draggable windows on the frequency
> axis; a redshift histogram of the real HerBS sample; live RSGquality
> score as a stacked bar: robust / ambiguous / silent; the population
> chorus plays the mix. A budget: total bandwidth is fixed.)*
>
> Chase the score. Notice what happens when you cluster windows low
> (deep redshifts vanish), or spread thin (everything beats, nothing locks).
>
> *(when the player plateaus: reveal the paper's optimum — windows in both
> the 3 mm and 2 mm bands — and overlay their score.)*
>
> The real version of this puzzle was solved in the paper this game is
> built on. The answer — you need BOTH bands — now steers real telescope
> time on the largest array on Earth.

## Ch. 9 — This was real

> Every number you just played with is real. The galaxies are real
> (Herschel and South-Pole-Telescope surveys). The windows are ALMA's.
> The method is Bakx & Dannerbauer (2022), MNRAS 515, 678 — "High-z
> Sudoku". The code scoring your sandbox is the paper's own, ported and
> verified.
>
> - the paper (open access) · the code (GitHub) · ALMA · what's DESHIMA?
> - Astronomers: the sandbox accepts real tunings. Steal it for your
>   proposal. *(link: sandbox permalink with shareable settings)*
>
> Made with sound on purpose. The universe is a chord; someone had to
> play it.

*(credits: paper authors, game credits, Nicky Case inspiration nod,
open-source licence.)*
