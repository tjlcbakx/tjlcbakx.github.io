# SCRIPT.md — narrative text, draft 1

> **Superseded as the source of truth (2026-08-31).** The shipped copy now
> lives in `game/index.html`; edit it there. This file is kept as the design
> draft — it records the intended beat of each chapter, which is still the
> thing to check a rewrite against. Where the two differ, the built game wins
> (e.g. Ch. 4's "seven candidate redshifts" is thirteen in the real tuning).

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

## Ch. 2 — Sixty-six dishes in a desert

> ALMA: sixty-six dishes on Chajnantor, 5 km up. Water vapour absorbs
> *broadly* across the mm range — the bands are the gaps between its lines, and
> only gaps when the air is dry. **The 116–125 GHz hole between Bands 3 and 4 is
> the O₂ line at 118.75 GHz, not water**: it never opens, at any altitude.
>
> For a redshift search you are not using the array as an interferometer at all
> — sixty-six dishes as one bucket, feeding a spectrometer. (Cashes the title,
> and supports "not a photograph".)
>
> Plant the direction of frequency early: more waves per second = higher note,
> so redshift moves lines *down* this axis. Without it, f₀/(1+z) reads as
> contradicting Ch. 1's "multiply by (1+z)".
>
> Heterodyne in plain words — difference against a reference tone — which
> doubles as the first mention of **beats**, the Ch. 4 mechanic. Then the
> correlator as channeliser.
>
> Name the object before leaning on it: the channelised output **is a
> spectrum**, and the word is used five times across the game without ever
> being defined. Playtest finding: a newcomer knows it is something you *have*,
> that has a *depth*, and that can be *silent* — three properties of a thing
> they have never seen a picture of. So: show one.
>
> *(figure: `diagram` — a real spectrum. A strip showing the whole 139.9–162.7
> window with a 4 GHz sliver highlighted, then that sliver full width: stepped
> channels, a shaded noise band, CO(5-4) at 155.772 GHz standing well clear of
> it with a visible width, and one labelled empty patch. Deliberately the same
> 155.772 GHz the player is handed in Ch. 4, so the detection there is already
> an old friend. Seeded noise, so the art is reproducible.)*
>
> Then the three words, explicitly: you *have* a spectrum; its *depth* is the
> height of the noise; most of it is *silent*, and how deep the silence goes is
> the difference between evidence and an absence of evidence. That last clause
> is what Ch. 7's exclusion argument and the bench's depth control both stand on.
>
> Precision: the maser is ~10⁶ better than needed, so the instrument never
> limits you; the line has *width* because the gas orbits, and the error bar is
> width ÷ signal-to-noise. This has to be said explicitly or it reads as
> contradicting Ch. 1's "*exact* frequencies". "Measured, not estimated" needs
> "for these galaxies the optical route is shut" or it sounds like radio
> chauvinism.
>
> Vocabulary ladder, stated as a nesting: spectrum → ten **bands** → two
> **windows** (~23 GHz, what you searched) → **tunings** (7.5 GHz each). Define
> *window* in the prose, never only in the caption. Do not reuse "window" for
> ALMA's 1.875 GHz spectral windows — say sub-bands or sidebands.
>
> *(figure: `diagram` — ALMA's two bands on a vertical frequency axis at left,
> that same axis as the RSG's y axis at right, one f₀/(1+z) curve descending
> through the two window stripes. Static SVG; the chapter is the axis lesson.
> Annotations that earn their keep: a dashed panel divider (without it the band
> blocks read as data at negative z), the O₂ tag in the gap, the ▲ saying the
> curve enters off-scale at 346 GHz, and leader lines to the green segments.)*
>
> Pitch payoff, and it must include the transposition or a knowledgeable reader
> bounces: you cannot hear 155 GHz, so divide by 250 million → ~360–650 Hz.
> **Linearly** — ratios survive, so a chord in the sky is the same chord in the
> headphones. (`audio.js`: `GHZ_TO_HZ = 4`.)

*(fold-out: "how wide is one tuning, really?" — 7.5 GHz in four 1.875 GHz
slices across two sidebands, so a window is tunings placed with care, not laid
end to end; why *these* windows (two rungs at once over the widest z span,
which Ch. 9 lets you try to beat); WSU at least doubles it.)*

*(known gap: this is the longest chapter and the only one with nothing to
touch. A slider dragging one line down the axis, sounding it, silent outside a
window would deliver the transposition, "not observed", and f₀/(1+z) at once —
and would put Ch. 4's beats within reach.)*

## Ch. 3 — The galaxy is a chord

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

## Ch. 4 — You are a radio telescope

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

## Ch. 5 — Two notes are (almost) a song

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

## Ch. 6 — The impostor

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

## Ch. 7 — Listen for the silence

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

## Ch. 8 — Three real galaxies

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

## Ch. 9 — Design the search

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

## Ch. 10 — This was real

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
