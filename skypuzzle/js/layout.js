/* layout.js — where things go.
 *
 * Two ways to arrange the same data, behind one interface:
 *
 *   board  the reference figure: the six survey fields packed side by side
 *          onto one rectangular board (`Snapshots/alma_sky_positions.png`).
 *   sky    the real celestial sphere, plate carree: world x = 360 - RA,
 *          world y = Dec + 90, wrapping in RA.
 *
 * The sky projection is *exact* for these panels, not an approximation: each
 * field's background was sampled on a grid uniform in (dRA * cos(dec_c), dDec)
 * with cos(dec_c) a constant per field, so in an (RA, Dec) map every panel is
 * still an axis-aligned rectangle — one `drawImage`, no resampling. Its width
 * in RA is the board width divided by cos(dec_c), which is why the same panels
 * look wider here: that is the projection stretching, as it should.
 *
 * World coordinates are degrees, origin bottom-left, y UP. Everything
 * downstream (pan, zoom, snap, previews) works in world coordinates and does
 * not care which layout produced them.
 */

const DEG = Math.PI / 180;

/** Wrap an angle difference into [-180, 180]. */
export function wrapDeg(d) {
  return d - 360 * Math.round(d / 360);
}

/** Board degrees -> sky, inverting export_assets.board_position(). */
export function boardToRaDec(f, wx, wy) {
  const ra = (f.ra_c + (f.w_deg / 2 - (wx - f.x_deg)) / f.cosd + 360) % 360;
  return [ra, f.dec_c + (wy - f.y_deg) - f.h_deg / 2];
}

// ---------------------------------------------------------------------------

export function boardLayout(fieldsJson) {
  const F = fieldsJson.fields;
  return {
    id: 'board',
    label: 'Composite board',
    w: fieldsJson.board_deg[0],
    h: fieldsJson.board_deg[1],
    wrap: 0,                       // no wrap: the board has edges

    panelRect(name) {
      const f = F[name];
      return { x: f.x_deg, y: f.y_deg, w: f.w_deg, h: f.h_deg };
    },
    sourceXY(s) { return [s.x_deg, s.y_deg]; },
    sourceR(s) { return [s.r_deg, s.r_deg]; },

    fieldAt(wx, wy) {
      for (const name in F) {
        const f = F[name];
        if (wx >= f.x_deg && wx <= f.x_deg + f.w_deg &&
            wy >= f.y_deg && wy <= f.y_deg + f.h_deg) return name;
      }
      return null;
    },
    radec(wx, wy) {
      const name = this.fieldAt(wx, wy);
      return name ? boardToRaDec(F[name], wx, wy) : null;
    },
    /** Degrees on the sky between a world point and a source. */
    dist(wx, wy, s) { return Math.hypot(wx - s.x_deg, wy - s.y_deg); },
  };
}

// ---------------------------------------------------------------------------

export function skyLayout(fieldsJson) {
  const F = fieldsJson.fields;
  const wxOf = (ra) => ((360 - ra) % 360 + 360) % 360;

  return {
    id: 'sky',
    label: 'Whole sky',
    w: 360,
    h: 180,
    wrap: 360,                     // RA is cyclic: pan straight through 0h

    panelRect(name) {
      const f = F[name];
      const halfRa = (f.w_deg / 2) / f.cosd;
      return {
        x: wxOf(f.ra_c + halfRa),  // highest RA is the panel's left edge,
        y: f.dec_c - f.h_deg / 2 + 90,   // exactly as on the board
        w: 2 * halfRa,
        h: f.h_deg,
      };
    },
    sourceXY(s) { return [wxOf(s.ra_deg), s.dec_deg + 90]; },
    sourceR(s) {
      // a circle on the sky is an ellipse in plate carree
      return [s.r_deg / Math.cos(s.dec_deg * DEG), s.r_deg];
    },

    fieldAt(wx, wy) {
      for (const name in F) {
        const r = this.panelRect(name);
        const dx = ((wx - r.x) % 360 + 360) % 360;
        if (dx <= r.w && wy >= r.y && wy <= r.y + r.h) return name;
      }
      return null;
    },
    radec(wx, wy) {
      return [((360 - wx) % 360 + 360) % 360, wy - 90];
    },
    dist(wx, wy, s) {
      const [ra, dec] = this.radec(wx, wy);
      const dra = wrapDeg(ra - s.ra_deg) * Math.cos(dec * DEG);
      return Math.hypot(dra, dec - s.dec_deg);
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * The Galactic plane in equatorial coordinates (J2000), as a polyline of
 * world points, split where it crosses the RA seam. Drawn faintly in the sky
 * view: it is the only other landmark out there, and it is *why* the survey
 * fields sit where they do — they were chosen to avoid it.
 */
export function galacticPlane(layout, stepDeg) {
  const raG = 192.85948, decG = 27.12825, lNCP = 122.93192;
  const sinDg = Math.sin(decG * DEG), cosDg = Math.cos(decG * DEG);
  const segments = [];
  let run = [];
  let prevX = null;
  for (let l = 0; l <= 360 + 1e-9; l += stepDeg) {
    const t = (lNCP - l) * DEG;
    const dec = Math.asin(cosDg * Math.cos(t)) / DEG;
    const ra = (raG + Math.atan2(Math.sin(t), -sinDg * Math.cos(t)) / DEG + 720) % 360;
    const [x, y] = layout.sourceXY({ ra_deg: ra, dec_deg: dec });
    if (prevX !== null && Math.abs(x - prevX) > 180) {
      if (run.length > 1) segments.push(run);
      run = [];
    }
    run.push([x, y]);
    prevX = x;
  }
  if (run.length > 1) segments.push(run);
  return segments;
}
