const assert = require("node:assert");
const V = require("../js/vision.js");
const G = require("../js/grid.js");

const W = 800;
const H = 600;
const cell = 50;
const mx = 100;
const my = 40;
const rgba = new Uint8Array(W * H * 4).fill(255);
for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = 255;
const gridW = cell * 9;
for (let i = 0; i <= 9; i++) {
  const t = i === 0 || i === 9 ? 5 : 3;
  for (let dy = -Math.floor(t / 2); dy <= Math.floor(t / 2); dy++)
    for (let dx = 0; dx < gridW; dx++) {
      const px = mx + dx;
      const py = my + i * cell + dy;
      if (py >= 0 && py < H) for (let k = 0; k < 4; k++) rgba[(py * W + px) * 4 + k] = k === 3 ? 255 : 0;
    }
  for (let dx = -Math.floor(t / 2); dx <= Math.floor(t / 2); dx++)
    for (let dy = 0; dy < gridW; dy++) {
      const px = mx + i * cell + dx;
      const py = my + dy;
      if (px >= 0 && px < W) for (let k = 0; k < 4; k++) rgba[(py * W + px) * 4 + k] = k === 3 ? 255 : 0;
    }
}
function drawDigit(r, c, kind) {
  const cx = Math.round(mx + (c + 0.5) * cell);
  const cy = Math.round(my + (r + 0.5) * cell);
  const s = Math.round(cell * 0.28);
  for (let dy = -s; dy <= s; dy++)
    for (let dx = -s; dx <= s; dx++) {
      let inside = false;
      if (kind === "dot") inside = dx * dx + dy * dy <= (s * 0.5) ** 2;
      if (kind === "ring") {
        const d = Math.sqrt(dx * dx + dy * dy);
        inside = d <= s && d >= s * 0.55;
      }
      if (kind === "bar") inside = Math.abs(dx) <= s * 0.25 && Math.abs(dy) <= s;
      if (inside) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < W && py >= 0 && py < H)
          for (let k = 0; k < 4; k++) rgba[(py * W + px) * 4 + k] = k === 3 ? 255 : 0;
      }
    }
}
drawDigit(0, 0, "dot");
drawDigit(4, 4, "ring");
drawDigit(8, 8, "bar");

const { gray, bin } = V.preprocessPhoto(rgba, W, H);
assert.strictEqual(gray.length, W * H);
assert.strictEqual(bin.length, W * H);
let ink = 0;
for (let i = 0; i < bin.length; i++) ink += bin[i];
assert.ok(ink > 10000, "seuillage adaptatif trouve les traits");

const det = G.detectGrid(bin, W, H);
assert.ok(det, "grille détectée après seuillage");
const warpSize = V.GRID_PIXELS;
const warped = G.warpGrid(gray, W, H, det.corners, warpSize);
assert.ok(warped);
const cells = V.extractCells(warped, warpSize);
assert.strictEqual(cells.length, 81);
const filled = [cells[0], cells[4 * 9 + 4], cells[8 * 9 + 8]];
const empty = cells[1 * 9 + 1];
for (const cl of filled) {
  const ratio = V.cellInkRatio(cl.pixels);
  assert.ok(ratio > 0.03, `cellule remplie ${cl.row},${cl.col} a assez d'encre (${ratio.toFixed(3)})`);
}
const emptyRatio = V.cellInkRatio(empty.pixels);
assert.ok(emptyRatio < 0.01, `cellule vide a peu d'encre (${emptyRatio.toFixed(4)})`);

const input = V.cellToMnistInput(filled[0].pixels);
assert.strictEqual(input.length, V.CELL_SIZE * V.CELL_SIZE);
let maxV = 0;
for (const v of input) maxV = Math.max(maxV, v);
assert.ok(Math.abs(maxV - 1) < 1e-6, "entrée MNIST normalisée dans [0,1]");

console.log("vision.test.js: tous les tests passent");
