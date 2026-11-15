'use strict';
/* Chip versions (well-array presets) for Digital Microscope Gridoverlay Studio.
 *
 * You can edit this file in any plain-text editor (Notepad, TextEdit in plain-text mode, VS Code, etc.).
 * All lengths are in micrometres (µm), and for every chip:
 *     pitch = well + wall
 *
 * What each field means:
 *   id        name shown in the Chip version panel (put it in quotes, must be unique)
 *   shape     'square' or 'circle'
 *   bottom    short description of the well bottom (shown in the info box)
 *   draft     draft angle in % or degrees (or null if none; shown in the info box)
 *   pitch     centre-to-centre distance between neighbouring wells (µm)
 *   well      well opening size (µm)
 *   wall      wall thickness between wells (µm) — must equal pitch - well
 *   depth     well depth (µm; shown in the info box)
 *   widthUm   nominal total array width (µm; shown in the info box)
 *   lengthUm  nominal total array length (µm; shown in the info box)
 *   wide      number of wells across (horizontal)
 *   long      number of wells down (vertical)
 *
 * Only shape, well, pitch, wide and long affect how the grid is drawn; the other fields are informational.
 *
 * How to add a new chip version:
 *   1. Copy one of the lines below and paste it on a new line before the closing ];
 *   2. Change the name and numbers, keeping the quotes, colons, curly braces and commas as they are.
 *   3. Save this file and reload the page in your browser.
 *
 * If a line has a mistake (for example well larger than pitch, or wall not matching pitch - well),
 * the app will report the problem in the Chip version panel instead of failing silently. */

// ("var", not "const", on purpose: if a line below has a mistake the app can still start and tell you about it.)
var BUILTIN_CHIPS = [
  {id: 'V1-Square', shape: 'square', bottom: '12% draft angle', draft: 12,   pitch: 500, well: 470, wall: 30, depth: 400, widthUm: 19500, lengthUm: 9500,  wide: 39,  long: 19},
  {id: 'V3.1',      shape: 'square', bottom: 'square',          draft: 0,    pitch: 200, well: 170, wall: 30, depth: 400, widthUm: 8000,  lengthUm: 8000,  wide: 40,  long: 40},
  {id: 'V3.2',      shape: 'square', bottom: 'radius 20 µm',    draft: null, pitch: 200, well: 170, wall: 30, depth: 50,  widthUm: 8000,  lengthUm: 8000,  wide: 40,  long: 40},
  {id: 'V7.0',      shape: 'square', bottom: 'square',          draft: 0,    pitch: 100, well: 50,  wall: 50, depth: 50,  widthUm: 8000,  lengthUm: 8000,  wide: 80,  long: 80},
  {id: 'V9.0',      shape: 'circle', bottom: 'square',          draft: 0,    pitch: 60,  well: 50,  wall: 10, depth: 50,  widthUm: 20000, lengthUm: 18000, wide: 333, long: 300},
  {id: 'V9.1',      shape: 'circle', bottom: 'square',          draft: 0,    pitch: 60,  well: 50,  wall: 10, depth: 50,  widthUm: 7500,  lengthUm: 7500,  wide: 125, long: 125},
  {id: 'V9.2',      shape: 'circle', bottom: 'square',          draft: 0,    pitch: 60,  well: 50,  wall: 10, depth: 50,  widthUm: 10000, lengthUm: 9000,  wide: 166, long: 150},
  {id: 'V10.2',     shape: 'square', bottom: 'radius 20 µm',    draft: 0,    pitch: 120, well: 80,  wall: 40, depth: 200, widthUm: 8000,  lengthUm: 8000,  wide: 66,  long: 66},
  {id: 'V11',       shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 120, well: 80,  wall: 40, depth: 200, widthUm: 10000, lengthUm: 10000, wide: 83,  long: 83},
  {id: 'V12',       shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 200, well: 170, wall: 30, depth: 200, widthUm: 10000, lengthUm: 10000, wide: 49,  long: 49},
  {id: 'V15.1',     shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 75,  well: 50,  wall: 25, depth: 100, widthUm: 10000, lengthUm: 10000, wide: 133, long: 133},
  {id: 'V15.2',     shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 100, well: 50,  wall: 50, depth: 100, widthUm: 10000, lengthUm: 10000, wide: 100, long: 100},
];
