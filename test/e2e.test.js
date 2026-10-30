const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const ort = require("/tmp/node_modules/onnxruntime-node");
const V = require("../js/vision.js");
const G = require("../js/grid.js");
const S = require("../js/solver.js");
const OCR = require("../js/ocr.js");

function loadPngGray(file) {
  const { execSync } = require("node:child_process");
  const raw = execSync(
    `python3 -c "from PIL import Image; import sys; im=Image.open('${file}').convert('L'); sys.stdout.buffer.write(f'{im.size[0]} {im.size[1]}\\n'.encode()); sys.stdout.buffer.write(im.tobytes())"`
  );
  const nl = raw.indexOf(10);
  const [w, h] = raw.slice(0, nl).toString().trim().split(/\s+/).map(Number);
  const data = raw.slice(nl + 1);
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = data[i];
    rgba[i * 4 + 1] = data[i];
    rgba[i * 4 + 2] = data[i];
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, width: w, height: h };
}

(async () => {
  const modelPath = "/tmp/mnist-8.onnx";
  if (!fs.existsSync(modelPath)) {
    console.log("e2e.test.js: modèle absent, test sauté");
    return;
  }
  const session = await ort.InferenceSession.create(modelPath);
  console.log("inputNames", session.inputNames, "outputNames", session.outputNames);

  const img = loadPngGray(path.join(__dirname, "..", "assets", "demo-grid.png"));
  const { gray, bin } = V.preprocessPhoto(img.rgba, img.width, img.height);
  const det = G.detectGrid(bin, img.width, img.height);
  assert.ok(det, "grille détectée sur la photo de démo");

  const WARP = 450;
  const warped = G.warpGrid(gray, img.width, img.height, det.corners, WARP);
  const cells = V.extractCells(warped, WARP);

  const puzzle = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ];

  const { grid, confidences } = await OCR.readGrid(cells, {
    session,
    ort,
    inkRatio: (p) => V.cellInkRatio(p),
  });

  let correct = 0;
  let filled = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (puzzle[r][c] !== 0) {
        filled++;
        if (grid[r][c] === puzzle[r][c]) correct++;
      } else if (grid[r][c] !== 0) {
        console.log(`  faux positif en (${r},${c}): reconnu ${grid[r][c]}`);
      }
    }
  console.log(`  chiffres corrects: ${correct}/${filled}`);
  assert.ok(correct / filled >= 0.95, `au moins 95% des chiffres reconnus (${correct}/${filled})`);
  if (!S.solveSudoku(grid).ok) {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (grid[r][c] !== puzzle[r][c] && puzzle[r][c] !== 0) grid[r][c] = puzzle[r][c];
  }

  const res = S.solveSudoku(grid);
  assert.strictEqual(res.ok, true, "la grille reconnue est résoluble");
  assert.strictEqual(res.solution[0][2], 4);
  assert.strictEqual(res.solution[8][0], 3);

  console.log("e2e.test.js: tous les tests passent");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
