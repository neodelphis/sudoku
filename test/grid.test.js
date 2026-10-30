const assert = require("node:assert");
const G = require("../js/grid.js");

function makeSyntheticGridImage(width, height, marginX, marginY, cell, thick, values) {
  const img = new Uint8Array(width * height).fill(255);
  const x0 = marginX;
  const y0 = marginY;
  const gridW = cell * 9;
  const gridH = cell * 9;
  for (let i = 0; i <= 9; i++) {
    const t = i === 0 || i === 9 ? thick + 2 : thick;
    const x = Math.round(x0 + i * cell);
    const y = Math.round(y0 + i * cell);
    for (let dy = -Math.floor(t / 2); dy <= Math.floor(t / 2); dy++) {
      for (let dx = 0; dx < gridW; dx++) {
        const px = x0 + dx;
        const py = y + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) img[py * width + px] = 0;
      }
    }
    for (let dx = -Math.floor(t / 2); dx <= Math.floor(t / 2); dx++) {
      for (let dy = 0; dy < gridH; dy++) {
        const px = x + dx;
        const py = y0 + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) img[py * width + px] = 0;
      }
    }
  }
  if (values) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (values[r][c]) {
          const cx = Math.round(x0 + (c + 0.5) * cell);
          const cy = Math.round(y0 + (r + 0.5) * cell);
          const s = Math.round(cell * 0.3);
          for (let dy = -s; dy <= s; dy++)
            for (let dx = -s; dx <= s; dx++)
              if (dx * dx + dy * dy <= s * s) {
                const px = cx + dx;
                const py = cy + dy;
                if (px >= 0 && px < width && py >= 0 && py < height) img[py * width + px] = 0;
              }
        }
      }
    }
  }
  return img;
}

function toBinary(gray) {
  const b = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) b[i] = gray[i] < 128 ? 1 : 0;
  return b;
}

const W = 800;
const H = 600;
const cell = 50;
const mx = 100;
const my = 40;
const gray = makeSyntheticGridImage(W, H, mx, my, cell, 3);
const bin = toBinary(gray);

const det = G.detectGrid(bin, W, H);
assert.ok(det, "grille détectée");
assert.strictEqual(det.lines.x.length, 10);
assert.strictEqual(det.lines.y.length, 10);
for (let i = 0; i < 10; i++) {
  assert.ok(Math.abs(det.lines.x[i] - (mx + i * cell)) <= 2, `ligne x ${i}: ${det.lines.x[i]} ~ ${mx + i * cell}`);
  assert.ok(Math.abs(det.lines.y[i] - (my + i * cell)) <= 2, `ligne y ${i}: ${det.lines.y[i]} ~ ${my + i * cell}`);
}

const warpSize = 450;
const warped = G.warpGrid(gray, W, H, det.corners, warpSize);
assert.ok(warped, "warp ok");
assert.strictEqual(warped.length, warpSize * warpSize);
const cellW = warpSize / 9;
let darkOnLine = 0;
for (let x = Math.floor(2 * cellW); x < Math.floor(3 * cellW); x++) {
  if (warped[Math.round(2 * cellW) * warpSize + x] < 128) darkOnLine++;
  if (warped[Math.round(5 * cellW) * warpSize + x] < 128) darkOnLine++;
}
assert.ok(darkOnLine > (cellW * 2) * 0.8, "les lignes de la grille sont présentes aux frontières des cellules après warp");
let darkInCell = 0;
for (let y = Math.floor(2 * cellW + 6); y < Math.floor(3 * cellW - 6); y++)
  for (let x = Math.floor(2 * cellW + 6); x < Math.floor(3 * cellW - 6); x++)
    if (warped[y * warpSize + x] < 128) darkInCell++;
assert.strictEqual(darkInCell, 0, "l'intérieur d'une cellule vide reste blanc après warp");
const centerDark = warped[Math.floor(warpSize / 2) * warpSize + Math.floor(warpSize / 2)];
assert.ok(centerDark > 200, "le centre de la grille warpée est clair (pas de ligne au milieu)");

const h = G.homographyFromCorners(G.findGridCorners ? [[0, 0], [1, 0], [1, 1], [0, 1]] : null, det.corners);
assert.ok(h);
const [bx, by] = G.applyHomography(h, 0, 0);
assert.ok(Math.abs(bx - det.corners[0][0]) < 0.5 && Math.abs(by - det.corners[0][1]) < 0.5);
const [ex, ey] = G.applyHomography(h, 1, 1);
assert.ok(Math.abs(ex - det.corners[2][0]) < 0.5 && Math.abs(ey - det.corners[2][1]) < 0.5);

const blank = new Uint8Array(W * H).fill(0);
assert.strictEqual(G.detectGrid(blank, W, H), null, "pas de grille dans une image noire uniforme");

console.log("grid.test.js: tous les tests passent");
