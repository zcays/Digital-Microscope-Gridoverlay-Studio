'use strict';
/* autofit-app.js — the app side of Auto-fit and Auto-fix distortion: run the analysis (autofit.js) on the loaded image and the
 * ticked chip, apply the result to S.lens / S.img / S.warp, one-step undo, and the plain-language result message.
 *   autoFit() / autoFixDistortion()   button + shortcut entry points (show progress, then the outcome)
 *   autoFitNow(distortionOnly)        does it synchronously and returns the result object ({ok, reason} or {ok, th, mesh, stats})
 *   undoAutoFit()                     back to the settings before the last successful run
 *   afMessage(res, distortionOnly)    what the user is told: errors, how much of the array was visible, what to check by eye
 *   afCurrent() / afApply()           S ↔ the 22-number parameter vector used by afForward()
 * A refused fit changes nothing (the previous layout is restored). */

let afUndoState = null;
const afSnapshot = () => ({arrayOnly: S.chip.arrayOnly, lens: {...S.lens}, img: {x: S.img.x, y: S.img.y, scale: S.img.scale, rot: S.img.rot}, warp: JSON.parse(JSON.stringify(S.warp))});
function afRestore(s) { S.chip.arrayOnly = s.arrayOnly; if (s.layout) { Object.assign(S.chip, s.layout.chip); Object.assign(S.doc, s.layout.doc); S.zoom = s.layout.zoom; refresh('grid', 'layout', 'crop'); } Object.assign(S.lens, s.lens); Object.assign(S.img, s.img); Object.assign(S.warp, JSON.parse(JSON.stringify(s.warp))); refresh('gl', 'warp', 'crop', 'status'); }
/** Current image settings as a parameter vector (the inverse of afApply). */
function afCurrent() {
  const c = S.warp.c, d = S.warp.dev;
  return [S.lens.bypass ? 0 : S.lens.k1, S.lens.bypass ? 0 : S.lens.k2, S.img.rot, S.img.scale, S.img.x, S.img.y,
          c.nw.x, c.nw.y, c.ne.x - 1, c.ne.y, c.se.x - 1, c.se.y - 1, c.sw.x, c.sw.y - 1, d.n.x, d.n.y, d.e.x, d.e.y, d.s.x, d.s.y, d.w.x, d.w.y];
}
function afApply(res, distortionOnly) {
  const t = res.th;
  if (!distortionOnly) { Object.assign(S.lens, {k1: t[AF_K1], k2: t[AF_K2], bypass: false}); Object.assign(S.img, {rot: t[AF_ROT], scale: t[AF_SCALE], x: t[AF_X], y: t[AF_Y]}); }
  Object.assign(S.warp, {enabled: true, mesh: res.mesh,
    c: {nw: {x: t[6], y: t[7]}, ne: {x: 1 + t[8], y: t[9]}, se: {x: 1 + t[10], y: 1 + t[11]}, sw: {x: t[12], y: 1 + t[13]}},
    dev: {n: {x: t[14], y: t[15]}, e: {x: t[16], y: t[17]}, s: {x: t[18], y: t[19]}, w: {x: t[20], y: t[21]}}});
  refresh('gl', 'warp', 'status');
}

/** Run the analysis on the loaded image for the ticked chip and apply the result. distortionOnly = keep tilt / size / position / lens
 *  and only re-fit the distortion (handles + fine mesh) from where the image is now. Returns the result object. */
function autoFitNow(distortionOnly = false) {
  return afFitImage(distortionOnly, null);
}
function autoFitFromCorners(pts, preserveShape = false) { return afFitImage(false, {corners: pts, preserveShape}); }
function afFitImage(distortionOnly, start) {
  const P = activePreset();
  if (!S.img.el) return {ok: false, reason: 'Load an image first.'};
  if (!P) return {ok: false, reason: 'Tick the chip version first, so I know which grid to fit.'};
  const before = afSnapshot();
  if (!S.chip.fit) before.layout = {chip: JSON.parse(JSON.stringify(S.chip)), doc: {...S.doc}, zoom: S.zoom};
  let res;
  try {
    if (!S.chip.fit) setChipFit(true);                            // the array needs a defined place on the canvas
    const L = gridLayout(S.doc.w, S.doc.h);
    res = afCompute(S.img.el, S.img.w, S.img.h, P, {x0: L.x0, y0: L.y0, pitch: L.pitchX, size: L.size}, S.doc, S.lens, distortionOnly ? {th: afCurrent(), mesh: S.warp.enabled ? S.warp.mesh : null} : start);
  } catch (err) { if (before.layout) afRestore(before); throw err; }
  if (!res.ok) { if (before.layout) afRestore(before); return res; }
  afUndoState = before;
  afApply(res, distortionOnly);
  if (!distortionOnly && typeof afterAutoFit === 'function') afterAutoFit(res);
  return res;
}
function afMessage(res, distortionOnly) {
  if (!res.ok) return `${distortionOnly ? 'Auto-fix distortion' : 'Auto-fit'} did not change anything. ${res.reason}`;
  if (res.mode === 'shape') return 'Aligned using rotation, uniform scale and position. Check the four edges against the grid.';
  if (res.mode === 'corners' && !res.stats.refined) return 'Lined up from your four corners only. The wells could not be measured well enough to refine it, so check by eye.';
  const s = res.stats, pct = v => (v * 100).toFixed(0) + '%', worst = Math.max(...Object.values(s.sideErr).filter(v => v === v), 0);
  const head = res.mode === 'corners' ? 'Lined up from your four corners and the wells' : distortionOnly ? 'Distortion fixed' : `Auto-fit done: tilt ${(-s.tiltDeg).toFixed(1)}° removed`;
  let msg = `${head}. Typical error ${s.medianImagePx.toFixed(1)} px (${pct(s.medianWell)} of a well; ${pct(s.medianHandlesOnly / s.harmonic)} before the fine correction), worst side ${pct(worst)}, ${pct(s.inliers)} of the visible wells matched.`;
  if (s.visible < .9) msg += ` Wells were clearly seen in ${pct(s.visible)} of the array; the rest (covered or faint) is placed from those.`;
  const check = [];
  if (s.edgeSure[0] < AF.minEdgeSure) check.push('the left/right edges of the array could not be located confidently, so it may sit a whole well off sideways');
  if (s.edgeSure[1] < AF.minEdgeSure) check.push('the top/bottom edges of the array could not be located confidently, so it may sit a whole well off up/down');
  if (s.hiddenCorners.length) check.push(`the ${s.hiddenCorners.join(' and ')} corner${s.hiddenCorners.length > 1 ? 's are' : ' is'} covered, faint or outside the view`);
  if (check.length) msg += ` Please check by eye: ${check.join('; ')}. Arrow keys nudge the image.`;
  return [msg, ...(s.warnings || [])].join(' ');
}
/** Button / shortcut entry points: show progress and the outcome. */
function afRunCorners(pts, onDone, preserveShape = false) { afRun(false, () => autoFitFromCorners(pts, preserveShape), onDone); }
function afRun(distortionOnly, run = () => autoFitNow(distortionOnly), onDone) {
  const say = t => { for (const id of ['#autoFitInfo', '#warpFixInfo']) { const e = $(id); if (e) e.textContent = t; } };
  say('Analysing the picture…'); toast('Analysing the picture…');
  setTimeout(() => {                                               // let the message paint before the heavy work
    let res; try { res = run(); } catch (err) { console.error(err); res = {ok: false, reason: 'An internal error occurred (see the browser console).'}; }
    const msg = afMessage(res, distortionOnly); toast(msg); say(msg); syncAll(); if (onDone) onDone(res);
  }, 40);
}
const autoFit = () => afRun(false), autoFixDistortion = () => afRun(true);
function undoAutoFit() { if (!afUndoState) return; afRestore(afUndoState); afUndoState = null; for (const id of ['#autoFitInfo', '#warpFixInfo']) { const e = $(id); if (e) e.textContent = 'Undone.'; } syncAll(); }
