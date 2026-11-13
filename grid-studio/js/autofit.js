'use strict';
/* autofit.js — "Auto-fit image to grid": looks at the photo, finds the chip's well lattice and sets tilt, scale, position,
 * fisheye strength and the distortion handles so the photo lines up with the ticked chip version's grid. One button, no clicking on wells.
 *
 * HOW IT WORKS (vision helpers are in cv.js; this file is the chip-specific part)
 *  1. Lattice frequency: the wells repeat, so the 2-D spectrum of the edge image has two perpendicular peaks → pitch (px) and tilt.
 *  2. Demodulation: for each of the two wall directions compute the local PHASE of that repetition. "f·r + phase" is a continuous
 *     wall index (integer on every wall). It does not care whether walls look dark or bright, only that they repeat.
 *  3. Unwrap the phase from the strongest area outwards → wall indices that are consistent across the array (seed data).
 *  4. Fit the app's own image model (lens k1 → rotate/scale/translate → distortion handles) so that every sample lands on its wall.
 *     Tilt/scale/position are fitted first, THEN the distortion handles with tilt/scale frozen (fitting both at once is degenerate).
 *  5. Which wall is the first one? The array is found as the block where BOTH directions repeat; the exact first/last wall is chosen
 *     by the line energy at the candidate edge walls. The chip's well count (wide × long) fixes the block size.
 *  6. Refit on all samples inside the array with wrapped (mod 1) residuals, re-check the edges, add edge bows, report the error.
 *
 * afForward() MUST mirror the renderers: if the image maths in gl.js / cpu.js / warp.js changes, change it here too
 * (tests.html fits a synthetic chip and then checks the rendered picture against the grid).
 * Troubleshooting: after a run, AF.debug in the browser console holds the internals (peaks, extents, per-stage errors, first walls).
 * Units: source-image px in, canvas px out; "lattice" coordinates are in pitches, with walls 0..N on the integers. */

const AF = {
  pxPerWell: 28,            // working resolution: about this many px per well if the array filled the frame
  minWork: 1024, maxWork: 2048,
  minStrength: 6,           // spectrum peak / median: below this there is no regular grid in the picture
  maxMedianError: .10,      // lattice periods; above this the fit is rejected (random data gives .25)
  minInliers: .75,          // share of samples within a quarter period of their wall (random data gives .5)
  maxSpill: .55,            // well pattern just outside the fitted array, relative to inside; more = the photo has more wells than the chip
};
const AF_K1 = 0, AF_K2 = 1, AF_ROT = 2, AF_SCALE = 3, AF_X = 4, AF_Y = 5, AF_WARP = 6;       // parameter vector layout (22 numbers)
const AF_STEPS = [1e-4, 1e-4, 1e-3, 1e-5, 1e-2, 1e-2, ...new Array(16).fill(1e-5)];

/** Forward image model: source px (sx, sy) → canvas px, written to out[0], out[1]. geo = {w, h, cx, cy, docW, docH}. */
function afForward(th, geo) {
  const k1 = th[AF_K1], k2 = th[AF_K2], a = th[AF_ROT] * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), sc = th[AF_SCALE];
  const lcx = geo.cx * geo.w, lcy = geo.cy * geo.h, R = .5 * Math.hypot(geo.w, geo.h), lens = k1 !== 0 || k2 !== 0;
  const ox = th[AF_X] + geo.w * sc / 2, oy = th[AF_Y] + geo.h * sc / 2, hw = geo.w / 2, hh = geo.h / 2;
  let warped = false; for (let i = AF_WARP; i < AF_WARP + 16; i++) if (th[i] !== 0) { warped = true; break; }
  // 3×3 control points of the distortion patch, same construction as warpControlPoints() in warp.js
  const w = th, nwx = w[6], nwy = w[7], nex = 1 + w[8], ney = w[9], sex = 1 + w[10], sey = 1 + w[11], swx = w[12], swy = 1 + w[13];
  const nx = (nwx + nex) / 2 + w[14], ny = (nwy + ney) / 2 + w[15], ex = (nex + sex) / 2 + w[16], ey = (ney + sey) / 2 + w[17];
  const sx_ = (sex + swx) / 2 + w[18], sy_ = (sey + swy) / 2 + w[19], wx = (swx + nwx) / 2 + w[20], wy = (swy + nwy) / 2 + w[21];
  const cx = (nwx + nex + sex + swx) / 4 + (w[14] + w[16] + w[18] + w[20]) / 2, cy = (nwy + ney + sey + swy) / 4 + (w[15] + w[17] + w[19] + w[21]) / 2;
  return (sx, sy, out) => {
    let mx = (sx - lcx) / R, my = (sy - lcy) / R;
    if (lens) {                                                  // invert r' = r(1 − k1 r² − k2 r⁴): the shader maps corrected → source, we need source → corrected
      const rm = Math.hypot(mx, my); let r = rm;
      for (let i = 0; i < 6; i++) { const r2 = r * r; r -= (r - k1 * r * r2 - k2 * r * r2 * r2 - rm) / (1 - 3 * k1 * r2 - 5 * k2 * r2 * r2); }
      if (rm > 1e-9) { mx *= r / rm; my *= r / rm; }
    }
    const dx = (lcx + mx * R - hw) * sc, dy = (lcy + my * R - hh) * sc;
    let px = ox + cs * dx - sn * dy, py = oy + sn * dx + cs * dy;
    if (warped) {
      const u = px / geo.docW, v = py / geo.docH;
      const a0 = 2 * (u - .5) * (u - 1), a1 = -4 * u * (u - 1), a2 = 2 * u * (u - .5), b0 = 2 * (v - .5) * (v - 1), b1 = -4 * v * (v - 1), b2 = 2 * v * (v - .5);
      px = (b0 * (a0 * nwx + a1 * nx + a2 * nex) + b1 * (a0 * wx + a1 * cx + a2 * ex) + b2 * (a0 * swx + a1 * sx_ + a2 * sex)) * geo.docW;
      py = (b0 * (a0 * nwy + a1 * ny + a2 * ney) + b1 * (a0 * wy + a1 * cy + a2 * ey) + b2 * (a0 * swy + a1 * sy_ + a2 * sey)) * geo.docH;
    }
    out[0] = px; out[1] = py;
  };
}

const afErf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
const afPercentile = (arr, p) => { const a = Array.from(arr).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.round(p / 100 * (a.length - 1))))] : NaN; };

/** The whole analysis. Pure: does not touch app state.
 *  imgEl + imgW/imgH: the source picture. chip: {wide, long}. grid: {x0, y0, pitch, size} of the chip grid on the canvas (px).
 *  doc: {w, h}. lens: {cx, cy}. Returns {ok, reason} or {ok: true, th, stats}. */
function afCompute(imgEl, imgW, imgH, chip, grid, doc, lens) {
  const t0 = performance.now(), gap = grid.pitch - grid.size, geo = {w: imgW, h: imgH, cx: lens.cx, cy: lens.cy, docW: doc.w, docH: doc.h};
  // What repeats in an edge image? Each well has two edges. If the well is about half the pitch the two edges are evenly spaced, so the
  // edge pattern repeats at HALF the pitch (q = 2) and sits on the well edges; otherwise it repeats at the pitch (q = 1), centred on the walls.
  const q = Math.abs(Math.cos(Math.PI * grid.size / grid.pitch)) < .35 ? 2 : 1;
  const P = grid.pitch / q;                                                              // lattice period on the canvas (px)
  const N = q === 2 ? [2 * chip.wide - 1, 2 * chip.long - 1] : [chip.wide, chip.long];   // periods across the array, per canvas axis
  const org = q === 2 ? [grid.x0, grid.y0] : [grid.x0 - gap / 2, grid.y0 - gap / 2];     // canvas position of lattice line 0

  /* 1. working image, edges, lattice frequency */
  const ws = Math.min(1, clamp(Math.max(...N) * AF.pxPerWell / q, AF.minWork, AF.maxWork) / Math.max(imgW, imgH));
  const w = Math.round(imgW * ws), h = Math.round(imgH * ws);
  const g = cvBlur(cvGrayFromImage(imgEl, w, h), w, h, 1), {gx, gy} = cvGradients(g, w, h);
  const maxPitch = 1.15 * Math.max(w, h) / Math.min(chip.wide, chip.long);
  const feature = gr => { const a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = Math.abs(gr[i]); const bg = cvBlur(a, w, h, Math.max(8, .6 * maxPitch)); for (let i = 0; i < a.length; i++) a[i] -= bg[i]; return a; };
  const pk = cvLatticePeaks([feature(gx), feature(gy)], w, h, 1 / maxPitch, Math.min(.25, 2 * Math.max(chip.wide, chip.long) / (.15 * Math.min(w, h))));
  if (!pk || pk.strength < AF.minStrength) return {ok: false, reason: 'No regular grid of wells was found in the picture.'};

  /* 2 + 3. local phase of each wall direction on a coarse grid, unwrapped into a consistent line index K */
  let fam, pitchW, step, cw, ch, nc, xw, yw, turned;
  const analyse = (f1, f2) => {
    fam = [f1, f2].map(f => ({f, len: Math.hypot(f.x, f.y)})); pitchW = 2 / (fam[0].len + fam[1].len); step = Math.max(3, Math.round(.4 * pitchW));
    if (pitchW < 4.5) return false;
    for (const F of fam) Object.assign(F, cvDemodulate(gx, gy, w, h, F.f, step));
    cw = fam[0].cw; ch = fam[0].ch; nc = cw * ch; xw = new Float32Array(nc); yw = new Float32Array(nc);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { xw[j * cw + i] = i * step + (step >> 1); yw[j * cw + i] = j * step + (step >> 1); }
    for (const F of fam) {
      F.frac = new Float32Array(nc);                                                     // line index mod 1 = f·r + phase (not unwrapped)
      const phase = new Float32Array(nc), mask = new Uint8Array(nc), thr = .18 * afPercentile(F.amp, 90);
      for (let i = 0; i < nc; i++) { phase[i] = Math.atan2(F.im[i], F.re[i]) / (2 * Math.PI); mask[i] = F.amp[i] > thr ? 1 : 0; F.frac[i] = F.f.x * xw[i] + F.f.y * yw[i] + phase[i]; }
      const un = cvUnwrap(phase, F.amp, mask, cw, ch), reached = []; F.K = new Float32Array(nc);
      for (let i = 0; i < nc; i++) { F.K[i] = F.f.x * xw[i] + F.f.y * yw[i] + un[i]; if (!isNaN(F.K[i])) reached.push(F.K[i]); }
      F.extent = (afPercentile(reached, 95) - afPercentile(reached, 5)) / .9;            // periods across the patterned area
    }
    return true;
  };
  const dbg = AF.debug = {q, N, peaks: [pk.f1, pk.f2], strength: pk.strength, ws};   // last run's internals, for troubleshooting in the console
  const tooSmall = {ok: false, reason: 'The wells are too small in this picture to line up automatically (they need to be at least ~5 px each).'};
  if (!analyse(pk.f1, pk.f2)) return tooSmall;
  // Is the photo turned ~90° relative to the chip? Only matters (and is only detectable) for non-square arrays.
  const decideTurn = () => { turned = N[0] !== N[1] && Math.abs(Math.log(fam[0].extent / fam[1].extent) - Math.log(N[1] / N[0])) < Math.abs(Math.log(fam[0].extent / fam[1].extent) - Math.log(N[0] / N[1])); };
  decideTurn();
  // The spectrum can lock onto the wrong harmonic (pitch vs half pitch). The chip's well count says how many periods the array must span.
  const periodsRatio = () => (fam[0].extent / (turned ? N[1] : N[0]) + fam[1].extent / (turned ? N[0] : N[1])) / 2;
  let ratio = periodsRatio(); dbg.firstRatio = ratio; dbg.firstExtents = [fam[0].extent, fam[1].extent];
  if (ratio > 1.45 && ratio < 2.7) { if (!analyse({x: pk.f1.x / 2, y: pk.f1.y / 2}, {x: pk.f2.x / 2, y: pk.f2.y / 2})) return tooSmall; decideTurn(); ratio = periodsRatio(); }
  else if (ratio > .36 && ratio < .68) { if (!analyse({x: pk.f1.x * 2, y: pk.f1.y * 2}, {x: pk.f2.x * 2, y: pk.f2.y * 2})) return tooSmall; decideTurn(); ratio = periodsRatio(); }
  const wrongChip = {ok: false, reason: `The well pattern in the picture does not match this chip version (${chip.wide} × ${chip.long} wells). Is the right version ticked, and is the whole array in the picture?`};
  if (ratio < .7 || ratio > 1.4) return wrongChip;
  Object.assign(dbg, {ratio, turned, extents: [fam[0].extent, fam[1].extent], f: [fam[0].f, fam[1].f], pitchW});
  const axes = turned ? [{F: fam[1], sign: -1}, {F: fam[0], sign: 1}] : [{F: fam[0], sign: 1}, {F: fam[1], sign: 1}];   // canvas X, canvas Y
  const sgeo = new Float32Array(nc); for (let i = 0; i < nc; i++) sgeo[i] = Math.sqrt(fam[0].amp[i] * fam[1].amp[i]);   // lattice present in BOTH directions

  /* model helpers */
  const th = new Array(22).fill(0), tmp = [0, 0];
  th[AF_ROT] = -Math.atan2(fam[0].f.y, fam[0].f.x) * 180 / Math.PI + (turned ? 90 : 0);
  th[AF_SCALE] = P * ws / pitchW;
  const lattice = (t, idx, axis) => { const fw = afForward(t, geo), out = new Float64Array(idx.length); for (let n = 0; n < idx.length; n++) { fw(xw[idx[n]] / ws, yw[idx[n]] / ws, tmp); out[n] = (tmp[axis] - org[axis]) / P; } return out; };
  const subsample = (idx, max) => { if (idx.length <= max) return idx; const s = idx.length / max, o = []; for (let i = 0; i < max; i++) o.push(idx[Math.floor(i * s)]); return o; };
  const fit = (free, resid, fScale, label) => {
    const r = cvLeastSquares(x => { const t = th.slice(); free.forEach((p, i) => t[p] = x[i]); return resid(t); }, free.map(p => th[p]), free.map(p => p === AF_SCALE ? AF_STEPS[p] * th[AF_SCALE] : AF_STEPS[p]), fScale);
    free.forEach((p, i) => th[p] = r.x[i]);
    if (label) { const e = Array.from(resid(th), Math.abs); (dbg.stages = dbg.stages || []).push(`${label}: median ${afPercentile(e, 50).toFixed(3)} k1 ${th[AF_K1].toFixed(3)} rot ${th[AF_ROT].toFixed(2)} scale ${th[AF_SCALE].toFixed(4)}`); }
    return r;
  };
  const corners = [6, 7, 8, 9, 10, 11, 12, 13], bows = [14, 15, 16, 17, 18, 19, 20, 21], similarity = [AF_ROT, AF_SCALE, AF_X, AF_Y];

  /* 4. coarse solution from the unwrapped samples. Their line indices are absolute (no mod-1 ambiguity), so this cannot slip by a wall.
        Order matters: tilt/scale/position → + lens → distortion corners with tilt/scale frozen (fitting them together is degenerate). */
  const seed = axes.map(A => { const idx = []; for (let i = 0; i < nc; i++) if (!isNaN(A.F.K[i])) idx.push(i); return subsample(idx, 5000); });
  if (seed[0].length < 200 || seed[1].length < 200) return {ok: false, reason: 'Too little of the well pattern is visible to line it up.'};
  const koff = [0, 0];                                             // whole lines to subtract so that the array's first line gets index 0
  const residSeed = t => { const out = new Float64Array(seed[0].length + seed[1].length); let o = 0; axes.forEach((A, axis) => { const l = lattice(t, seed[axis], axis); for (let n = 0; n < l.length; n++) out[o++] = l[n] - (A.sign * A.F.K[seed[axis][n]] - koff[axis]); }); return out; };
  const solveSeed = tag => {
    for (let i = AF_WARP; i < 22; i++) th[i] = 0;
    fit(similarity, residSeed, .1, tag + ' tilt/scale/position'); fit([AF_K1, ...similarity], residSeed, .1, tag + ' + lens'); fit([AF_K1, ...corners], residSeed, .1, tag + ' + corners');
  };
  axes.forEach((A, axis) => { const l = lattice(th, seed[axis], axis), d = []; for (let n = 0; n < l.length; n++) d.push(A.sign * A.F.K[seed[axis][n]] - l[n]); th[AF_X + axis] += afPercentile(d, 50) * P; });
  dbg.init = th.slice(0, 6); dbg.seedN = [seed[0].length, seed[1].length]; dbg.offsets = [];
  solveSeed('seed');

  /* 5. where does the array start? returns the wall index (per axis) of the array's first wall in the current model */
  const findOffsets = () => {
    const fw = afForward(th, geo), lat = [new Float32Array(nc), new Float32Array(nc)];
    for (let i = 0; i < nc; i++) { fw(xw[i] / ws, yw[i] / ws, tmp); lat[0][i] = (tmp[0] - org[0]) / P; lat[1][i] = (tmp[1] - org[1]) / P; }
    const band = axes.map((A, axis) => { const v = Array.from(lattice(th, seed[axis], axis)); return [afPercentile(v, 10), afPercentile(v, 90)]; });
    const coarse = [0, 0], nb = 4, sig = 1.2 * Math.SQRT2;
    for (let round = 0; round < 3; round++) for (let axis = 0; axis < 2; axis++) {
      // profile of the two-direction lattice energy along this axis, then slide a (blurred) box of N pitches over it
      const o = 1 - axis, lo = band[o][0] + 2, hi = band[o][1] - 2; let bmin = Infinity, bmax = -Infinity;
      for (let i = 0; i < nc; i++) if (lat[o][i] > lo && lat[o][i] < hi) { const b = Math.floor(lat[axis][i] * nb); if (b < bmin) bmin = b; if (b > bmax) bmax = b; }
      if (!isFinite(bmin)) continue;
      const sum = new Float64Array(bmax - bmin + 1), cnt = new Float64Array(bmax - bmin + 1);
      for (let i = 0; i < nc; i++) if (lat[o][i] > lo && lat[o][i] < hi) { const b = Math.floor(lat[axis][i] * nb) - bmin; sum[b] += sgeo[i]; cnt[b]++; }
      const med = afPercentile(cnt, 50), prof = sum.map((s, b) => cnt[b] < .3 * med ? 0 : s / cnt[b]), u = b => (b + bmin + .5) / nb;
      let best = -Infinity, bestU = coarse[axis];
      for (let u0 = u(0) + 1; u0 < u(prof.length - 1) - N[axis] - 1; u0 += .05) {
        let sc = 0; for (let b = 0; b < prof.length; b++) { const uu = u(b); if (uu > u0 - 6 && uu < u0 + N[axis] + 6) sc += prof[b] * (.5 * (afErf((uu - u0) / sig) - afErf((uu - u0 - N[axis]) / sig)) - .5); }
        if (sc > best) { best = sc; bestU = u0; }
      }
      coarse[axis] = bestU; band[axis] = [bestU, bestU + N[axis]];
    }
    // exact wall: unsigned line energy per wall, from the full-resolution line images, folded along the lattice
    const nbf = 10, lo = -20, span = (Math.max(...N) + 40) * nbf, sum = [new Float64Array(span), new Float64Array(span)], cnt = [new Float64Array(span), new Float64Array(span)];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x++) {
      fw(x / ws, y / ws, tmp); const l0 = (tmp[0] - org[0]) / P, l1 = (tmp[1] - org[1]) / P, i = y * w + x;
      if (l1 > band[1][0] + 2 && l1 < band[1][1] - 2) { const b = Math.floor((l0 - lo) * nbf); if (b >= 0 && b < span) { sum[0][b] += axes[0].F.lines[i]; cnt[0][b]++; } }
      if (l0 > band[0][0] + 2 && l0 < band[0][1] - 2) { const b = Math.floor((l1 - lo) * nbf); if (b >= 0 && b < span) { sum[1][b] += axes[1].F.lines[i]; cnt[1][b]++; } }
    }
    return [0, 1].map(axis => {
      const med = afPercentile(cnt[axis].filter(c => c > 0), 50) || 1;
      const amp = k => {                                           // strength of the repetition in the cell centred on wall k (phase-agnostic)
        const i0 = Math.round((k - lo) * nbf) - nbf / 2; if (i0 < 0 || i0 + nbf > span) return 0;
        let mean = 0; for (let b = 0; b < nbf; b++) { if (cnt[axis][i0 + b] < .3 * med) return 0; mean += sum[axis][i0 + b] / cnt[axis][i0 + b]; } mean /= nbf;
        let re = 0, im = 0; for (let b = 0; b < nbf; b++) { const v = sum[axis][i0 + b] / cnt[axis][i0 + b] - mean, a = 2 * Math.PI * (b + .5) / nbf; re += v * Math.cos(a); im -= v * Math.sin(a); }
        return Math.hypot(re, im) * 2 / nbf;
      };
      let best = -Infinity, m0 = Math.round(coarse[axis]);
      for (let m = Math.floor(coarse[axis]) - 1; m <= Math.ceil(coarse[axis]) + 1; m++) { const sc = amp(m) + amp(m + N[axis]) - amp(m - 1) - amp(m + N[axis] + 1); if (sc > best) { best = sc; m0 = m; } }
      return m0;
    });
  };

  /* 6. number the lines from the array's first wall, then polish on EVERY sample inside the array using wrapped (mod 1) residuals */
  let roi = [], weights = [];
  const residWrapped = t => {
    const out = new Float64Array(2 * roi.length); let o = 0;
    axes.forEach((A, axis) => { const l = lattice(t, roi, axis); for (let n = 0; n < roi.length; n++) { const d = l[n] - A.sign * A.F.frac[roi[n]]; out[o++] = (d - Math.round(d)) * weights[axis][n]; } });
    return out;
  };
  for (let round = 0; round < 3; round++) {
    const off = findOffsets(); dbg.offsets.push(off);
    if (off[0] || off[1]) { koff[0] += off[0]; koff[1] += off[1]; th[AF_X] -= off[0] * P; th[AF_Y] -= off[1] * P; solveSeed('renumbered'); }
    else if (round > 0) break;
    const all = [], fw = afForward(th, geo);
    for (let i = 0; i < nc; i++) { fw(xw[i] / ws, yw[i] / ws, tmp); const a = (tmp[0] - org[0]) / P, b = (tmp[1] - org[1]) / P; if (a > -.25 && a < N[0] + .25 && b > -.25 && b < N[1] + .25) all.push(i); }
    roi = subsample(all, 7000);
    if (roi.length < 300) return {ok: false, reason: 'The well array could not be located in the picture.'};
    weights = axes.map(A => { const med = afPercentile(roi.map(i => A.F.amp[i]), 50) || 1; return roi.map(i => Math.min(2, A.F.amp[i] / med)); });
    fit([AF_K1, ...corners], residWrapped, .08, `polish ${round} lens + corners (n=${roi.length})`);
  }
  const noBows = th.slice();
  fit([AF_K1, ...corners, ...bows], residWrapped, .08, 'polish + edge bows');
  if (th.slice(AF_WARP).some(v => Math.abs(v) > .25) || Math.abs(th[AF_K1]) > 1) th.splice(0, 22, ...noBows);       // implausible → keep the simpler fit

  /* stats on unweighted wrapped residuals */
  const errs = []; axes.forEach((A, axis) => { const l = lattice(th, roi, axis); for (let n = 0; n < roi.length; n++) { const d = l[n] - A.sign * A.F.frac[roi[n]]; errs.push(Math.abs(d - Math.round(d))); } });
  const median = afPercentile(errs, 50), inliers = errs.filter(e => e < .25).length / errs.length;
  // Does the well pattern carry on beyond the fitted array? Then the photo has more wells than this chip version (wrong version ticked).
  const spill = (() => {
    const fw = afForward(th, geo), sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];           // inside, left, right, top, bottom
    for (let i = 0; i < nc; i++) {
      fw(xw[i] / ws, yw[i] / ws, tmp); const a = (tmp[0] - org[0]) / P, b = (tmp[1] - org[1]) / P, midA = a > 2 && a < N[0] - 2, midB = b > 2 && b < N[1] - 2;
      const k = midA && midB ? 0 : midB && a > -6 && a < -2.5 ? 1 : midB && a > N[0] + 2.5 && a < N[0] + 6 ? 2 : midA && b > -6 && b < -2.5 ? 3 : midA && b > N[1] + 2.5 && b < N[1] + 6 ? 4 : -1;
      if (k >= 0) { sum[k] += sgeo[i]; cnt[k]++; }
    }
    const inside = sum[0] / Math.max(1, cnt[0]);
    return [1, 2, 3, 4].map(k => cnt[k] > 30 ? sum[k] / cnt[k] / inside : 0);
  })();
  const stats = {medianPitch: median, medianImagePx: median * pitchW / ws, medianWell: median / q, inliers, pitchImagePx: q * pitchW / ws, harmonic: q, tiltDeg: th[AF_ROT], turned, strength: pk.strength,
                 spill, samples: roi.length, workSize: [w, h], ms: Math.round(performance.now() - t0), firstWall: koff.slice()};
  if (Math.max(...spill) > AF.maxSpill) return {...wrongChip, stats};
  if (median > AF.maxMedianError || inliers < AF.minInliers) return {ok: false, reason: `The wells were found but could not be lined up reliably (typical error ${(median / q * 100).toFixed(0)}% of a well).`, stats};
  return {ok: true, th, stats};
}

/* ---------------- app glue ---------------- */
let afUndoState = null;
const afSnapshot = () => ({lens: {...S.lens}, img: {x: S.img.x, y: S.img.y, scale: S.img.scale, rot: S.img.rot}, warp: JSON.parse(JSON.stringify(S.warp))});
function afRestore(s) { Object.assign(S.lens, s.lens); Object.assign(S.img, s.img); Object.assign(S.warp, JSON.parse(JSON.stringify(s.warp))); refresh('gl', 'warp', 'status'); }

/** Run the analysis on the loaded image for the ticked chip and apply the result. Returns the result object. */
function autoFitNow() {
  const P = activePreset();
  if (!S.img.el) return {ok: false, reason: 'Load an image first.'};
  if (!P) return {ok: false, reason: 'Tick the chip version first, so I know which grid to fit.'};
  if (!S.chip.fit) setChipFit(true);                              // the array needs a defined place on the canvas
  const L = gridLayout(S.doc.w, S.doc.h);
  const res = afCompute(S.img.el, S.img.w, S.img.h, P, {x0: L.x0, y0: L.y0, pitch: L.pitchX, size: L.size}, S.doc, S.lens);
  if (!res.ok) return res;
  afUndoState = afSnapshot();
  const t = res.th;
  Object.assign(S.lens, {k1: t[AF_K1], k2: t[AF_K2], bypass: false});
  Object.assign(S.img, {rot: t[AF_ROT], scale: t[AF_SCALE], x: t[AF_X], y: t[AF_Y]});
  Object.assign(S.warp, {enabled: true,
    c: {nw: {x: t[6], y: t[7]}, ne: {x: 1 + t[8], y: t[9]}, se: {x: 1 + t[10], y: 1 + t[11]}, sw: {x: t[12], y: 1 + t[13]}},
    dev: {n: {x: t[14], y: t[15]}, e: {x: t[16], y: t[17]}, s: {x: t[18], y: t[19]}, w: {x: t[20], y: t[21]}}});
  refresh('gl', 'warp', 'status');
  return res;
}
/** Button / shortcut entry point: shows progress and the outcome. */
function autoFit() {
  const info = $('#autoFitInfo'); if (info) info.textContent = 'Analysing the picture…';
  toast('Analysing the picture…');
  setTimeout(() => {                                               // let the message paint before the heavy work
    let res; try { res = autoFitNow(); } catch (err) { console.error(err); res = {ok: false, reason: 'Auto-fit hit an internal error (see the browser console).'}; }
    const s = res.stats, msg = res.ok
      ? `Auto-fit done: tilt ${(-s.tiltDeg).toFixed(1)}° removed, typical error ${s.medianImagePx.toFixed(1)} px (${(s.medianWell * 100).toFixed(0)}% of a well), ${(s.inliers * 100).toFixed(0)}% of the array matched.`
      : `Auto-fit did not change anything. ${res.reason}`;
    toast(msg); if (info) info.textContent = msg; syncAll();
  }, 40);
}
function undoAutoFit() { if (!afUndoState) return; afRestore(afUndoState); afUndoState = null; const info = $('#autoFitInfo'); if (info) info.textContent = 'Auto-fit undone.'; syncAll(); }
