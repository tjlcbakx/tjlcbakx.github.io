/* eggs.js — the "did you know?" notes.
 *
 * Every entry is tied to a real paper — Tom's own unless the paper is marked
 * `ext`, which is for a source whose story belongs to someone else's work — and to the source
 * it actually concerns: the names here are the same catalogue names the game
 * plays with (HerBS-n from Bakx et al. 2018, HeLMS-n / HerS-n from the HerMES
 * fields, Neg-n from Negrello et al. 2017), and every identification was
 * checked against the paper's own coordinates, not against its name.
 *
 * Facts and numbers come from the papers cited in PAPERS below — redshifts
 * from their line measurements, fluxes from the HerBS catalogue table. Nothing
 * here is inferred: if a paper does not say it, it is not written here.
 *
 * This file is hand-maintained. To add a note, add an entry keyed by the
 * source name; anything without an entry simply has no note.
 */

/* --- the papers, each cited once ---------------------------------------- */

export const PAPERS = {
  herbs: {
    c: 'Bakx et al. 2018, MNRAS 473, 1751',
    u: 'https://ui.adsabs.harvard.edu/abs/2018MNRAS.473.1751B/abstract',
    mine: true,
  },
  lenses: {
    c: 'Bakx et al. 2020, MNRAS 493, 4276',
    u: 'https://ui.adsabs.harvard.edu/abs/2020MNRAS.493.4276B/abstract',
    mine: true,
  },
  iram: {
    c: 'Bakx et al. 2020, MNRAS 496, 2372',
    u: 'https://ui.adsabs.harvard.edu/abs/2020MNRAS.496.2372B/abstract',
    mine: true,
  },
  sudoku: {
    c: 'Bakx & Dannerbauer 2022, MNRAS 515, 678',
    u: 'https://ui.adsabs.harvard.edu/abs/2022MNRAS.515..678B/abstract',
    mine: true,
  },
  herbs70: {
    c: 'Bakx et al. 2024, MNRAS 530, 4578',
    u: 'https://ui.adsabs.harvard.edu/abs/2024MNRAS.530.4578B/abstract',
    mine: true,
  },
  angels: {
    c: 'Bakx et al. 2024, MNRAS 535, 1533',
    u: 'https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.1533B/abstract',
    mine: true,
  },
  flash: {
    c: 'Bakx et al. 2024, MNRAS 527, 8865',
    u: 'https://ui.adsabs.harvard.edu/abs/2024MNRAS.527.8865B/abstract',
    mine: true,
  },
  bears: {
    c: 'Urquhart et al. 2022, MNRAS 511, 3017',
    u: 'https://doi.org/10.1093/mnras/stac150',
  },
  zgal: {
    c: 'Cox et al. 2023, A&A 678, A26',
    u: 'https://ui.adsabs.harvard.edu/abs/2023A%26A...678A..26C/abstract',
  },
  pilot: {
    c: 'Neri et al. 2020, A&A 635, A7',
    u: 'https://ui.adsabs.harvard.edu/abs/2020A%26A...635A...7N/abstract',
  },
  berta: {
    c: 'Berta et al. 2021, A&A 646, A122',
    u: 'https://ui.adsabs.harvard.edu/abs/2021A%26A...646A.122B/abstract',
  },
  dye: {
    c: 'Dye et al. 2022, MNRAS 510, 3734',
    u: 'https://ui.adsabs.harvard.edu/abs/2022MNRAS.510.3734D/abstract',
  },
  hers3: {
    c: 'Cox et al. 2025, ApJ 991, 53',
    u: 'https://doi.org/10.3847/1538-4357/adf204',
  },
  ivison: {
    c: 'Ivison et al. 2019, MNRAS 489, 427',
    u: 'https://doi.org/10.1093/mnras/stz2180',
    ext: true,               // not one of Tom's: the note carries no tag
  },
  geach: {
    c: 'Geach et al. 2023, Nature 621, 483',
    u: 'https://ui.adsabs.harvard.edu/abs/2023Natur.621..483G/abstract',
    ext: true,
  },
  deroo: {
    c: 'de Roo et al. 2025, MNRAS 540, L78',
    u: 'https://ui.adsabs.harvard.edu/abs/2025MNRAS.540L..78D/abstract',
    ext: true,
  },
  // Not a paper: the Chalmers news piece that HERS16 got a Valentine's day of
  // its own out of. Carries no tag for the same reason `ext` ones do not.
  hers16news: {
    c: 'Chalmers news, 14 February 2025',
    u: 'https://www.chalmers.se/en/current/news/see-a-message-of-love-from-a-galaxy-far-far-away/',
    ext: true,
  },
  negrello: {
    c: 'Negrello et al. 2017, MNRAS 465, 3558',
    u: 'https://ui.adsabs.harvard.edu/abs/2017MNRAS.465.3558N/abstract',
  },
};

/* --- one note per source ------------------------------------------------- */
/* t: headline, d: the note itself, p: key into PAPERS.                      */

export const EGGS = {

  // --- the ones with a story of their own ---------------------------------

  'HerBS-70': {
    t: 'Not a galaxy — a cluster being born',
    d: 'HerBS-70 is a binary: two dusty galaxies at z = 2.31, one of them hosting an active nucleus. Deep SCUBA-2 imaging around it found 21 more sub-mm sources, three of them confirmed at the same redshift — a protocluster whose halo should grow into something like Coma by today.',
    p: 'herbs70',
  },
  'HERS3': {
    t: 'An Einstein cross with a fifth image',
    d: 'HerS-3 is a starburst at z = 3.0607, lensed into four images — plus a rare fifth, central one. No lens model built from the four galaxies you can see reproduces it: the group needs an extra massive dark-matter halo. I was PI of the ALMA observations behind this.',
    p: 'hers3',
  },
  'HerBS-13': {
    t: 'The interstellar medium at 350 parsecs',
    d: 'Better known as ID141 (H-ATLAS J142413.9+022303), at z = 4.24, magnified 4.6 times by a galaxy at z = 0.6. ALMA resolved it down to 350 pc — the first spatially resolved look at the multi-phase interstellar medium of a galaxy this distant — and the [CI] line revealed a reservoir of cool gas that other tracers had missed entirely.',
    p: 'dye',
  },
  'HerBS-89': {
    t: 'A partial Einstein ring, seen through absorption',
    d: 'HerBS-89a sits at z = 2.9497. NOEMA at 0.3 arcsec resolution turned it into a one-arcsecond Einstein ring, and caught molecular ions OH+ and CH+ in absorption against its own dust continuum — a way of weighing gas that never emits a photon of its own.',
    p: 'berta',
  },
  'HerBS-38': {
    t: 'Three galaxies, one Herschel blob',
    d: "One of the eight sources in my IRAM 30m redshift hunt, and a stubborn one. NOEMA later split it into three: two galaxies at z = 2.42 and z = 2.48, and a third whose only consistent solution puts it at z = 6.57 — 12.6 billion years back, when the Universe was 800 million years old.",
    p: 'iram',
  },
  'HerBS-83': {
    t: 'The one that refused to be measured',
    d: 'Fifteen hours on the IRAM 30m produced several lines that flatly disagreed with each other about the redshift. Sources like this one are why I built the redshift-search graphs — a way of playing the possible line identifications off against each other. NOEMA later settled it: z = 3.9438.',
    p: 'sudoku',
  },
  'HerBS-52': {
    t: 'Pinned down at both ends of the CO ladder',
    d: 'The IRAM 30m found CO(5-4) and CO(6-5) here; the Green Bank Telescope then caught the ground-state CO(1-0) line, which fixes the redshift beyond argument at z = 3.4419. The photometric estimate from its Herschel colours had said 4.5 — which is why we chase the lines.',
    p: 'iram',
  },
  'HerBS-61': {
    t: 'Two lines, one distance',
    d: 'CO(4-3) in the first tuning, CO(6-5) in the second: two lines from the same ladder that agree only at z = 3.7293. One of the four confirmed distances from my IRAM 30m survey.',
    p: 'iram',
  },
  'HerBS-64': {
    t: 'Measured twice, 3000 km apart',
    d: 'The IRAM 30m in Spain found CO(4-3) and CO(6-5); the Green Bank Telescope in West Virginia added CO(1-0) and CO(2-1). Everything agrees on z = 4.0484, when the Universe was 1.5 billion years old.',
    p: 'iram',
  },
  'HerBS-177': {
    t: 'A redshift from a cold, quiet ladder',
    d: 'CO(4-3) and CO(6-5) put this one at z = 3.9633. Its CO ladder already slopes downwards by J = 4 — the gas is cooler and less excited than in most of its neighbours in the sample.',
    p: 'iram',
  },

  // --- the ANGELS pilot: six bands in six and a half hours ----------------

  'HerBS-21': {
    t: 'The complicated lens',
    d: 'Two galaxies at z = 3.323, and the only source in my ANGELS pilot whose lensing is more than a single galaxy lensing a single galaxy. Its CH+ and OH+ absorption lines are also the clearest evidence in the sample of gas flowing inwards — shocked gas sitting right next to the diffuse molecular reservoir.',
    p: 'angels',
  },
  'HerBS-22': {
    t: 'A near-complete Einstein ring',
    d: 'ANGELS shows it as an almost closed ring sitting directly behind its foreground galaxy, at z = 3.050. Three transitions of OH+ appear in absorption against its own continuum, and its star formation per unit area is close to the physical limit of what a galaxy can sustain.',
    p: 'angels',
  },
  'HerBS-25': {
    t: 'Lensed, and sharp enough to prove it',
    d: 'ANGELS caught this one at z = 2.912. At 0.1-0.5 arcsec, ALMA resolves the sources in the pilot from extended discs to strongly lensed arcs with magnifications between 2 and 30.',
    p: 'angels',
  },
  'HerBS-93': {
    t: 'z = 2.402, from six bands at once',
    d: 'An ANGELS target. Observing the same galaxy across ALMA Bands 3 through 8 catches CO transitions from (3-2) up to (18-17) in one campaign — enough to read the temperature and density of the gas, not just its distance.',
    p: 'angels',
  },
  'HerBS-155': {
    t: 'Two galaxies, one Herschel source',
    d: 'ANGELS shows a near-complete Einstein ring lying directly behind its foreground galaxy at z = 3.077, with a second source beside it seen only in dust. Resolved at 0.1-0.5 arcsec, the pilot\'s 16 Herschel sources turned into 26 galaxies.',
    p: 'angels',
  },
  'HerBS-170': {
    t: 'The brightest nitrogen emitter known',
    d: 'The stand-out of my ANGELS pilot. Its [N II] 205 micron line makes it the brightest nitrogen emitter observed anywhere to date; it is invisible to Hubble even though ALMA shows it extended, which takes a large, smooth screen of dust to pull off; and with no lensing galaxy anywhere near it, all of that luminosity is its own. ANGELS also settled its distance at z = 4.182, which two earlier lines had failed to pin down.',
    p: 'angels',
  },
  'HerBS-41': {
    t: 'Twelve lines on one galaxy',
    d: 'The most heavily observed source of the ANGELS pilot — 12 spectral lines targeted, including the [O I] 145 micron line — at z = 4.098, with two further components in the field seen only in dust. Its star formation per unit area sits at the extreme end of the whole sample.',
    p: 'angels',
  },
  'HerBS-42': {
    t: 'A genuine pair',
    d: 'ANGELS measured z = 3.307 and z = 3.314 for the two components — a velocity difference small enough that these two really are neighbours, not a chance alignment.',
    p: 'angels',
  },
  'HerBS-159': {
    t: 'The pair that vanished under high resolution',
    d: 'Both components sit at z = 2.236, but neither shows up in the sharpest ANGELS imaging: the emission of one is split across several sources about an arcsecond apart, and resolving a galaxy out of existence is a real hazard of long baselines.',
    p: 'angels',
  },
  'HerBS-86': {
    t: 'z = 2.564, from the ANGELS pilot',
    d: 'One of the 16 southern Herschel sources observed across ALMA Bands 3 to 8. The gas depletion times measured across the pilot run 100 Myr to 1 Gyr — these galaxies are burning through their fuel fast.',
    p: 'angels',
  },
  'HerBS-104': {
    t: 'A redshift that did not exist before',
    d: 'One of three ANGELS targets with no distance at all when we observed them: an earlier survey had found a single line at 90.91 GHz, which on its own means half a dozen possible redshifts. ANGELS added the lines that decide it — z = 1.536, the nearest galaxy in the pilot, and a partial Einstein ring.',
    p: 'angels',
  },
  'HerBS-106': {
    t: 'It keeps splitting',
    d: 'At z = 2.369, and one of the sources that breaks into several components below one arcsecond — the pilot found 26 resolved galaxies inside its 16 Herschel sources, which is exactly why resolution matters as much as sensitivity here.',
    p: 'angels',
  },
  'HerBS-184': {
    t: 'The other nitrogen emitter',
    d: 'One of only two galaxies in which ANGELS caught the [N II] 205 micron line in Band 7, which puts it and HerBS-170 at the bright end of every nitrogen scaling relation ever drawn. It stays a single source under ALMA resolution, and whether it is lensed at all is still an open question.',
    p: 'angels',
  },

  'HerBS-36': {
    t: 'Gas falling in',
    d: 'At z = 3.095, and one of four galaxies in my ANGELS pilot at the extreme end of star formation. Its shocked gas is redshifted with respect to the bulk of its molecular reservoir — gas falling inwards, which may be part of what feeds a starburst this violent.',
    p: 'angels',
  },
  'HerBS-81': {
    t: 'Two galaxies, two redshifts',
    d: 'The two components of this Herschel source sit at z = 3.160 and z = 2.588 — nothing to do with each other. The nearer one splits again into a double peak beside a Spitzer source, though the geometry is not that of a lens.',
    p: 'angels',
  },
  'HerBS-87': {
    t: 'One line, six answers',
    d: 'An earlier survey found a single emission line here at 160.96 GHz, which is not enough: one line allows several redshifts at once. The ANGELS observations added the lines that settle it at z = 2.059, and showed a near-complete Einstein ring behind a foreground galaxy.',
    p: 'angels',
  },

  // --- the NOEMA pilot ----------------------------------------------------

  'HerBS-34': {
    t: 'A redshift in a few hours',
    d: 'The NOEMA pilot survey put this one at z = 2.6637 from CO(3-2) and CO(5-4). Its wide bandwidth turned redshift hunting from a night-long gamble into a routine measurement.',
    p: 'pilot',
  },
  'HerBS-113': {
    t: 'Broad lines, fast gas',
    d: 'z = 2.7870, with CO lines about 900 km/s wide. The velocity field NOEMA measured across it is one of only four in the pilot sharp enough to map.',
    p: 'pilot',
  },
  'HerBS-154': {
    t: 'Compact, and full of water',
    d: 'A galaxy just 1.2 arcsec across at z = 3.7070, with CO(6-5), atomic carbon and a water line all detected. Water emission traces the warm, dense gas right where stars are forming.',
    p: 'pilot',
  },
  'HerBS-43': {
    t: 'Two galaxies that have nothing to do with each other',
    d: 'The NOEMA pilot found two sources a few arcseconds apart in this field — one at z = 3.2121, the other at z = 4.0543. Herschel saw a single blob; half a billion years of cosmic time separate them.',
    p: 'pilot',
  },
  'HerBS-95': {
    t: 'A binary at z = 2.97',
    d: 'Two galaxies, east and west, at z = 2.9718 and z = 2.9729 — the same redshift to within about a hundred km/s. Multiple systems like this one are how dusty starbursts betray the overdensities they live in.',
    p: 'pilot',
  },
  'HerBS-204': {
    t: 'A merger in progress',
    d: 'One of the hardest sources in the survey: the NOEMA pilot could not measure a redshift at all, and its continuum only appeared after stacking every line-free channel. z-GAL later found both halves at z = 3.4937 and 3.4933 — an interacting pair about 60 kpc apart.',
    p: 'zgal',
  },
  'HerBS-150': {
    t: 'A triple system',
    d: 'Three galaxies at z = 3.6732, 3.6682 and 3.6787 — all within about a thousand km/s of each other. It began as one of my IRAM 30m targets and ended up as a small group.',
    p: 'zgal',
  },
  'HerBS-205': {
    t: 'Three at once',
    d: 'z-GAL resolved this Herschel source into three galaxies, at z = 2.9600, 2.9599 and 2.9630 — a bound trio caught in the act of assembling.',
    p: 'zgal',
  },
  'HerBS-109': {
    t: 'Two neighbours and an impostor',
    d: 'Three sources in one beam: two really are a pair at z = 1.585, while the third sits far behind them at z = 2.84 and only looks like company.',
    p: 'zgal',
  },
  'HerBS-16': {
    t: 'Not a galaxy at all',
    d: 'Bright at 500 microns, and utterly unlike its neighbours: HerBS-16 (J1410+020) is a blazar — a jet from a supermassive black hole pointed almost straight at us. The z-GAL survey dropped it and its twin HerBS-112 from the target list for exactly that reason.',
    p: 'zgal',
  },
  'HerBS-112': {
    t: 'The other impostor',
    d: 'HerBS-112 (J1331+30) is the second blazar in the catalogue. Selecting galaxies by their brightness at 500 microns catches almost only dusty starbursts and lenses — but "almost only" is why every sample needs spectra.',
    p: 'zgal',
  },
  'HerBS-82': {
    t: 'One line is not enough',
    d: 'Of all the Herschel sources in z-GAL, only two gave up a single emission line instead of two or more, which leaves their redshift tentative: this one at z = 2.06, and HerS-19. Two lines, or it does not count.',
    p: 'zgal',
  },

  // --- distances from z-GAL ------------------------------------------------

  'HerBS-72':  { t: 'z = 3.6380', d: 'Measured from CO(4-3), CO(6-5) and atomic carbon by z-GAL, a NOEMA programme that scanned 126 bright Herschel sources for lines. Its light left when the Universe was 1.7 billion years old.', p: 'zgal' },
  'HerBS-78':  { t: 'z = 3.7344', d: 'Three lines — CO(3-2), CO(4-3) and CO(6-5) — agree on this distance. The redshift comes from z-GAL, the NOEMA survey that measured most of the distances in this game.', p: 'zgal' },
  'HerBS-108': { t: 'z = 3.7168', d: 'A faint CO(3-2) line, a clear CO(4-3) and a clear CO(6-5): the ladder of carbon monoxide transitions is what turns a smudge on a Herschel map into a distance.', p: 'zgal' },
  'HerBS-129': { t: 'z = 3.3074', d: 'CO(3-2) and CO(5-4), measured by z-GAL. Eleven and a half billion years of travel time for the light in this piece.', p: 'zgal' },
  'HerBS-149': { t: 'z = 2.6650', d: 'A narrow-lined galaxy: its CO lines are only about 240 km/s wide, among the narrowest in the z-GAL survey, where the average is closer to 590 km/s.', p: 'zgal' },
  'HerBS-185': { t: 'z = 4.3238', d: 'One of the more distant galaxies in z-GAL, identified from CO(7-6) and a water line. At this redshift the Universe was only 1.4 billion years old.', p: 'zgal' },
  'HerBS-188': { t: 'z = 2.7675', d: 'CO(3-2) and CO(5-4), with lines over 1000 km/s wide — a lot of gas moving fast. Only about a third of the z-GAL sources have lines this broad.', p: 'zgal' },
  'HerBS-191': { t: 'z = 3.4428', d: 'Measured by z-GAL from CO(4-3) and CO(5-4). Roughly 11.7 billion years of look-back time.', p: 'zgal' },
  'HELMS11':   { t: 'z = 2.4829', d: 'A HeLMS source — from the HerMES Large Mode Survey, the equatorial field this piece came out of. z-GAL measured its distance from CO(3-2) and CO(4-3).', p: 'zgal' },
  'HELMS25':   { t: 'z = 2.1404', d: 'CO(2-1) and CO(4-3) place it here, with lines over 900 km/s wide — well above the 590 km/s average of the survey.', p: 'zgal' },
  'HELMS27':   { t: 'z = 3.7652', d: 'One of the more distant HeLMS sources in z-GAL, from CO(4-3) and CO(6-5) — the light in this piece is 11.8 billion years old.', p: 'zgal' },
  'HELMS28':   { t: 'z = 2.5322', d: 'CO(3-2) plus atomic carbon, [CI](1-0) — the neutral carbon line is a direct tracer of the cold gas mass, and it is much harder to detect than CO.', p: 'zgal' },
  'HELMS39':   { t: 'z = 2.7659', d: 'Measured by z-GAL from CO(3-2) and CO(5-4) — two lines from the same ladder, which is the survey\'s standard for calling a redshift reliable.', p: 'zgal' },
  'HELMS41':   { t: 'z = 2.3353', d: 'From CO(3-2) and CO(4-3). z-GAL got reliable redshifts for 124 of its 126 targets — 165 individual galaxies, once the sources that split into several are counted separately.', p: 'zgal' },
  'HELMS46':   { t: 'z = 2.5765', d: 'CO(3-2) and CO(4-3), measured with NOEMA: almost eleven billion years of travel time for the light in this piece.', p: 'zgal' },
  'HELMS48':   { t: 'z = 3.3514', d: 'Three CO lines agree here — (3-2), (4-3) and (5-4). Three is comfortable; one is a guess.', p: 'zgal' },
  'HELMS55':   { t: 'z = 2.2834', d: 'A HeLMS source measured by z-GAL from CO(3-2) and CO(4-3). Its redshift sits almost exactly at the median of the survey, z = 2.56 — the peak epoch of galaxy formation.', p: 'zgal' },
  'HELMS19':   { t: 'A pair at the edge of the survey', d: 'Two galaxies, east and west, at z = 4.6871 and z = 4.6882 — neighbours 12.2 billion years ago, when the Universe was 1.25 billion years old.', p: 'zgal' },
  'HELMS24':   { t: 'z = 4.9841', d: 'One of the most distant sources in z-GAL, confirmed from CO(4-3), CO(5-4) and atomic carbon. The Universe was 1.2 billion years old.', p: 'zgal' },
  'HELMS45':   { t: 'Near the far edge of the survey', d: 'z = 5.3994, from CO(5-4), CO(8-7) and atomic carbon — the second highest redshift in z-GAL, whose 135 galaxies span 0.8 < z < 6.55. Its light has been travelling for 12.4 billion years, since the Universe was one billion years old.', p: 'zgal' },
  'HERS1': {
    t: 'A magnetic field, 2.5 billion years after the Big Bang',
    d: 'Called 9io9 by the people who found it, HerS-1 here: a lensed starburst at z = 2.553, forming stars more than a thousand times faster than the Milky Way, and the galaxy in which polarized light from dust was detected this far away — grains lining up with the local magnetic field. The median polarization is about 1 per cent, as in nearby spirals, and points to an ordered field 5 kiloparsecs across, around 500 microgauss or less, lying parallel to the molecular gas disc. ALMA and the lens together later resolved it into a 4-kiloparsec grand-design spiral whose arms follow that same polarized emission.',
    p: 'geach',
    p2: 'deroo',
  },
  'HERS16': {
    t: 'A message of love from a galaxy far, far away',
    d: 'The heart is the lens\u2019s doing, not the galaxy\u2019s: a projection effect, in a way similar to a rainbow — only visible from a certain perspective. "It would not look like this in any other galaxy than ours, so it is a show just for us." I found it browsing the z-GAL catalogue of more than a hundred lensed galaxies, and what you are looking at is most of the galaxy\u2019s heat radiation, emanating from where it is building up most of its stars.',
    p: 'hers16news',
  },
  'HERS2':     { t: 'z = 2.0151', d: 'A HerS source — from the Herschel Stripe 82 survey. CO(2-1) and CO(4-3) give the distance; 10.3 billion years of look-back time.', p: 'zgal' },
  'HERS11':    { t: 'z = 4.6618', d: 'One of the most distant sources in z-GAL, from CO(4-3) and CO(7-6). At this redshift the Universe was 1.3 billion years old — remarkably little time in which to build a galaxy this dusty.', p: 'zgal' },
  'HERS13':    { t: 'z = 2.4759', d: 'CO(3-2) and atomic carbon. [CI] is faint, but it measures the cold gas directly rather than through the usual chain of assumptions about CO.', p: 'zgal' },
  'HERS15':    { t: 'z = 2.3019', d: 'From CO(3-2) and CO(4-3), measured with NOEMA as part of z-GAL.', p: 'zgal' },
  'HERS9':     { t: 'The nearby one', d: 'z = 0.8530 — by far the closest galaxy in the survey, and the only one where the lines that gave it away were HCN and HCO+ rather than CO. Its light is a mere 7 billion years old.', p: 'zgal' },

  // --- the catalogue itself ------------------------------------------------

  'HerBS-1': {
    t: 'The brightest of them all',
    d: 'H-ATLAS J134429.5+303034: 343 mJy at 500 microns, the brightest source in the whole 616 square degrees of the Herschel survey that made the HerBS catalogue — which is why it is number 1. It sits at z = 2.30 and is magnified about 12 times by a galaxy at z = 0.67.',
    p: 'herbs',
  },
  'HerBS-2': {
    t: 'Number two by a nose',
    d: 'H-ATLAS J114637.9-001132, 292 mJy at 500 microns and z = 3.26 — a confirmed lens, magnified 7.6 times by a galaxy at z = 1.22. The HerBS catalogue is ordered by 500-micron brightness: I built it from the 209 brightest, most distant sources in the survey, and it became my PhD thesis.',
    p: 'herbs',
  },
  'HerBS-5': {
    t: 'Brighter in the sub-mm than it looks',
    d: 'H-ATLAS J125632.5+233627 at z = 3.56, magnified 11.3 times by a foreground galaxy at z = 0.26. Its 850-micron flux is the highest of the five brightest sources in the catalogue — a very cold, very distant spectrum behind a very ordinary lens.',
    p: 'herbs',
  },
  'HerBS-6': {
    t: 'The near one in the top ten',
    d: 'H-ATLAS J132427.0+284450 at z = 1.68 — the closest of the ten brightest sources in the catalogue, lensed by a galaxy at z = 1.00. The HerBS selection asked for an estimated redshift above 2; the spectra do not always agree.',
    p: 'herbs',
  },

  'HerBS-19': {
    t: 'SDP.81',
    d: 'One of the first five lenses Herschel ever found, and the one ALMA turned into a textbook figure. A galaxy at z = 3.04, magnified 16 times by a foreground galaxy at z = 0.30 — the largest magnification measured anywhere in that census of Herschel lenses.',
    p: 'negrello',
  },
  'HerBS-59': {
    t: 'SDP.130',
    d: 'Another of the original five Herschel lenses: z = 2.626, behind a galaxy at z = 0.22. Its magnification is only 2.1, which is a useful reminder that not every ring in this game is a strong one.',
    p: 'negrello',
  },
  'HerBS-4': {
    t: 'Lensed twice over',
    d: 'A galaxy at z = 3.634 with not one but two foreground galaxies in the line of sight, at z = 0.63 and z = 1.00, magnifying it 6.9 times between them.',
    p: 'negrello',
  },
  'HerBS-9': {
    t: 'Magnified eleven times',
    d: 'A confirmed lens at z = 3.675, brightened elevenfold by the mass in front of it. Without that, this galaxy would be far too faint for the ALMA snapshot in your hand.',
    p: 'negrello',
  },
  'HerBS-12': {
    t: 'Magnified thirteen times',
    d: 'H-ATLAS J133008.5+245900: a galaxy at z = 3.11 behind a lens at z = 0.43, magnified 13 times. Lensing is the only reason a galaxy this distant shows this much structure in a snapshot this short.',
    p: 'negrello',
  },
  'HerBS-3': {
    t: 'Confirmed, and modelled',
    d: 'A lens at z = 2.951 with a foreground galaxy at z = 0.79, magnified 4.1 times. High-resolution sub-mm imaging is what turns a suspected lens into a measured one.',
    p: 'negrello',
  },
  'HerBS-8': {
    t: 'A cluster of starbursts, not a lens',
    d: 'H-ATLAS J084933.4+021443 is not magnified at all. It is four dusty galaxies at z = 2.41 spread across 80 kpc, with a fifth protocluster member later confirmed by ALMA, and the brightest of them is a genuine hyperluminous galaxy: broad Halpha and bright X-rays betray a Type-1 active nucleus around a two-billion-solar-mass black hole.',
    p: 'ivison',
  },

  // --- the Negrello lensed sample ------------------------------------------

  'Neg1':  { t: 'No HerBS number', d: 'H-ATLAS J121334.9-020323, from the census of candidate lensed galaxies brighter than 100 mJy across 600 square degrees of Herschel data. A galaxy at z = 0.19 sits 0.2 arcsec away — a likely lens. Bright, but not distant enough for the HerBS cut.', p: 'negrello' },
  'Neg2':  { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J115101.7-020024. Selecting on 500-micron brightness alone is one of the most efficient ways ever found to build a sample of gravitational lenses — the background galaxies are rare, and almost anything that bright is magnified.', p: 'negrello' },
  'Neg3':  { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J120127.8-021648, one of the candidate lenses in the 600 square degree Herschel search. The magnification is what lets ALMA resolve a galaxy this far away at all.', p: 'negrello' },
  'Neg4':  { t: 'A lens with a known foreground', d: 'H-ATLAS J125759.5+224558. Its lensing galaxy has been identified in the optical, at a redshift of about 0.5 — a galaxy halfway across the Universe acting as the telescope for the one behind it.', p: 'negrello' },
  'Neg5':  { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J133255.6+265528. The nearest optical galaxy is four arcseconds away and almost certainly a chance alignment, so its lensing grade is the honest one: unclear.', p: 'negrello' },
  'Neg7':  { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J133038.2+255128, with a convincing foreground galaxy at about z = 0.2 less than an arcsecond away — a likely lens, and the kind of candidate only high-resolution follow-up can settle for good.', p: 'negrello' },
  'Neg8':  { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J010250.8-311723, in the South Galactic Pole field — the largest and emptiest of the six patches on this board.', p: 'negrello' },
  'Neg9':  { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J000912.7-300807: 353 mJy at 250 microns, one of the brighter candidates in the southern field, with no optical counterpart yet identified to act as its lens.', p: 'negrello' },
  'Neg10': { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J234357.7-351723, a 500-micron selected lens candidate from the southern Herschel field.', p: 'negrello' },
  'Neg11': { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J000722.1-352014, from the sample of candidate lensed galaxies selected across 600 square degrees of Herschel imaging.', p: 'negrello' },
  'Neg12': { t: 'From the lensed-galaxy sample', d: 'H-ATLAS J013004.0-305513, a candidate lens in the South Galactic Pole field.', p: 'negrello' },
};

/* --- notes that belong to the survey rather than to one galaxy ------------ */
/* Shown once, when the count of placed pieces first reaches `at`.           */

export const MILESTONES = [
  {
    at: 5,
    t: 'Where these pieces come from',
    d: 'The names on the pieces are a catalogue: 209 galaxies picked out of 616 square degrees of Herschel imaging as the brightest sources at 500 microns with an estimated redshift above 2. I built it, observed 189 of them with SCUBA-2 on Mauna Kea, and it became my PhD thesis.',
    p: 'herbs',
  },
  {
    at: 15,
    t: 'Why so many of them are rings',
    d: 'Cross-matching these sources against near-infrared imaging finds a foreground galaxy for 57 per cent of them, and implies that 82 per cent are gravitationally lensed. The lensed fraction falls as the 500-micron flux does — exactly as galaxy-evolution models predict.',
    p: 'lenses',
  },
  {
    at: 30,
    t: 'Turning ALMA into a redshift hunter',
    d: 'Most of the distances in these notes come from surveys built to measure them efficiently. BEARS tuned ALMA into a redshift hunter and measured 71 galaxies in one campaign, spanning 1.41 < z < 4.53; I am part of that team, and led much of the line analysis in its follow-up papers.',
    p: 'bears',
  },
  {
    at: 50,
    t: 'Reading a redshift off a graph',
    d: 'A single sub-mm line can mean half a dozen different redshifts. Playing the candidate identifications off against each other turns that ambiguity into a solvable puzzle — a graphical method that grew out of these very galaxies, and is now being turned into an online tool and a sound-based version.',
    p: 'sudoku',
  },
  {
    at: 75,
    t: 'Three thousand more lenses',
    d: 'ALMA imaging of 86 fainter Herschel sources confirmed 47 per cent of them as gravitational lenses. Applied to the whole 660 square degree survey, the method should identify around 3000 lenses — enough to use them as a cosmological sample rather than one curiosity at a time.',
    p: 'flash',
  },
];

/** How many notes exist for the sources in `pieces`, plus the milestones. */
export function eggTotal(pieces) {
  let n = MILESTONES.length;
  for (const p of pieces) if (EGGS[p.name]) n++;
  return n;
}
