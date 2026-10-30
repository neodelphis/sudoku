const assert = require("node:assert");
const OCR = require("../js/ocr.js");
const V = require("../js/vision.js");

const probs = OCR.softmax([1, 5, 0, 0, 0, 0, 0, 0, 0, 0]);
assert.ok(probs[1] > 0.9, "softmax concentre sur l'indice max");
assert.ok(Math.abs([...probs].reduce((a, b) => a + b, 0) - 1) < 1e-6, "softmax somme à 1");

const fakeOrt = {
  Tensor: class {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  },
};
const t = OCR.toMnistTensor(new Float32Array(784).fill(0.5), fakeOrt);
assert.deepStrictEqual(t.dims, [1, 1, 28, 28]);
assert.strictEqual(t.data.length, 784);

function fakeSessionFor(digit) {
  const logits = new Array(10).fill(0);
  logits[digit] = 10;
  return {
    inputNames: ["Input3"],
    outputNames: ["Plus214_Output_0"],
    run: async (feeds) => {
      const input = feeds["Input3"];
      let sum = 0;
      for (const v of input.data) sum += v;
      const out = new Array(10).fill(0);
      out[digit] = 10;
      if (sum === 0) out[0] = 5;
      return { Plus214_Output_0: { data: Float32Array.from(out) } };
    },
  };
}

(async () => {
  const filled = new Float32Array(784).fill(0.8);
  const r = await OCR.classifyCell(filled, { session: fakeSessionFor(7), ort: fakeOrt });
  assert.strictEqual(r.digit, 7);
  assert.ok(r.confidence > 0.99);

  const cells = [];
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 9; col++)
      cells.push({ row, col, pixels: new Float32Array(784).fill(row * 9 + col === 40 ? 0.9 : 0) });

  const sess = fakeSessionFor(3);
  const { grid, confidences } = await OCR.readGrid(cells, {
    session: sess,
    ort: fakeOrt,
    inkRatio: (p) => V.cellInkRatio(p.map((v) => 255 * (1 - v))),
  });
  assert.strictEqual(grid.length, 9);
  let nonZero = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (grid[r][c] !== 0) nonZero++;
  assert.strictEqual(nonZero, 1, "une seule cellule remplie reconnue");
  assert.strictEqual(grid[4][4], 3);
  assert.ok(confidences[4][4] > 0.99);

  console.log("ocr.test.js: tous les tests passent");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
