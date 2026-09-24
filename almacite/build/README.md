# Cite the ALMA receivers — build

`../index.html` is generated. Edit `page.tpl.html` (markup, styles, logic) or
`mkrefs.py` / `mkpage.py` (data), then run `./build.sh`. The page ships with the
data inlined, so it is a single self-contained file that works from `file://`.

`harvested.json` (11 KB) is the cached ADS-export harvest, filtered to just the
bibcodes the memo links to, and is kept as a provenance record — it names the
`.bib` file each entry came from. Delete it and `build.sh` rescans
`~/Dropbox/**/*.bib` via `harvest.py`. Verified: deleting the intermediates and
rebuilding reproduces `../index.html` byte-for-byte.

The three intermediates (`harvested.json`, `refs.json`, `data.json`) are **not
committed** — see `../.gitignore`. Each carries the local `.bib` path an entry
came from, and everything in this folder is served publicly by GitHub Pages, so
those paths stay on this machine. For the same reason `mkpage.py` drops the
`src` field before inlining the data: the page never renders provenance, so
there is nothing to gain by shipping it. A fresh clone therefore rebuilds by
rescanning `~/Dropbox/**/*.bib`, exactly as deleting `harvested.json` does here.

## Where the data comes from

Bands, reference labels, citation counts and links are transcribed from
**ALMA Memo 627**, *Compilation of Technical Papers on ALMA Receivers*,
Bakx & Conway, 14 November 2024 — [arXiv:2409.02164](https://arxiv.org/abs/2409.02164).
`memo627.txt` is `pdftotext -layout` of the arXiv PDF and is the transcription
source for Tables 1 and 2. It is kept here so the transcription can be rechecked
without re-downloading.

## The one rule

**No BibTeX entry was hand-written.** Every entry in `refs.json` comes from one
of exactly two places, recorded per entry in its `src` field:

| Source | How | Count |
|---|---|---|
| ADS export, harvested from Tom's own `.bib` files | `harvest.py` walks `~/Dropbox/**/*.bib`, keeps entries whose `adsurl` bibcode matches a bibcode in the memo's own links | 11 |
| Publisher record via `doi.org` content negotiation (`Accept: application/x-bibtex`) | `Bryerton2013`, `Huang2022`, `Yagoubov2020` | 3 |

Two edits are applied to the three fetched entries, both recorded in `mkrefs.py`:
titles are brace-protected in the ADS style (`title = "{...}"`) so case-changing
bibliography styles cannot lowercase "ALMA", and `Yagoubov2020`'s journal is the
ADS macro `\aap` rather than a literal `Astronomy & Astrophysics` — a raw `&`
is a fatal LaTeX error, which is how that bug was found.

Crossref's *fuzzy* bibliographic search was tried and rejected: queried by
author/title/year it returned the wrong paper for both references tested. Only
lookups anchored on a bibcode from the memo or on an exact DOI are used.

## Identification, and how each was checked

The memo cites papers by label ("Kerr et al. 2004"), so every entry had to be
tied to a specific paper. Anchors used, in order of preference:

- **ADS bibcode in the memo's own link** — 21 of the 34 references carry one.
- **Page range in the memo's PDF filename.** `Kerr et al. 2004` links to
  `.../2004055061.pdf`; the harvested `2004stt..conf...55K` is Kerr et al.,
  ISSTT XV, pages 55–61. Deterministic, not a guess.
- **arnumber inside the DOI.** `Bryerton et al. 2013` links to IEEE
  `arnumber=6697622`; the resolved DOI is `10.1109/MWSYM.2013.6697622`.
- **Title vs. band.** Every entry's fetched title names the band the memo
  assigns it to (Asayama → "ALMA Band 4 (125-163 GHz)", Kerr 2014 → "Band-3 and
  Band-6 Sideband-Separating SIS Mixers", and so on). All 13 Table 1 entries
  agree, which is an independent check on the transcription.

## Coverage

- **Table 1 (the per-band references): 13 of 13 have verified BibTeX.** This is
  the page's whole job, and it is complete.
- **Table 2 (appendix): 1 of 21** (`Claude2006`). The other 20 are listed on the
  page with the memo's links and citation counts, marked "export from link".
  Ten of those have ADS bibcodes but no local export; nine have no bibcode at
  all (IEEE, NRAO ISSTT proceedings, one Springer). Filling them needs either an
  ADS API token or the citation table compiled for the memo, which is currently a
  Dropbox online-only placeholder.

## Rules encoded from the memo

- The **local oscillator** (`Bryerton2013`) is common to all receiver bands
  *excluding future Band 2*, so it is added unless Band 2 is the only selection.
  (It is the local oscillator, not the correlator.)
- **`Kerr2014`** covers the Band 3 *and* Band 6 sideband-separating SIS mixers,
  so it is added once if either band is selected.
- **Band 6** has two Table 1 references, `Ediss2004` and `Kerr2004`.
- **Bands 1 and 2** are marked preliminary in the memo, whose final instrument
  papers were "expected within 6 to 8 months" as of November 2024. That window
  has passed, so the page says so and points at the ALMA Helpdesk.

## Tests

`./build.sh` ends by running `runtest.py`, which injects `test.js` into the real
generated page and drives it in headless Chrome across six band selections. It
asserts: non-empty outputs; no `undefined`/`NaN` leaking into text; every
`\citep`/`\citet` key has a matching BibTeX entry **and** every entry is cited;
the local-oscillator and `Kerr2014` rules hold; the preliminary note appears for
Bands 1–2; and the elided clause keeps its "by" (a real bug this caught).

The BibTeX was separately compiled for real — `pdflatex` + `bibtex` + `natbib`
over all 13 entries: 0 errors, 0 BibTeX warnings, 0 undefined citations, and no
lowercased "alma" in the rendered bibliography. Worth redoing after any data
change; it is what caught the raw ampersand.
