const MODEL_URL = "https://huggingface.co/onnxmodelzoo/mnist-8/resolve/main/mnist-8.onnx";

const visionRef =
  typeof module !== "undefined" && module.exports ? require("./vision.js") : window.SudokuVision;
const INPUT_NAME = "Input3";
const OUTPUT_NAME = "Plus214_Output_0";

let ortModule = null;
let sessionPromise = null;
let session = null;

async function loadOrt() {
  if (ortModule) return ortModule;
  if (typeof window === "undefined" || !window.ort) {
    throw new Error("onnxruntime-web (window.ort) n'est pas chargé");
  }
  ortModule = window.ort;
  ortModule.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/";
  return ortModule;
}

async function getSession() {
  if (session) return session;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await loadOrt();
      const s = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      session = s;
      return s;
    })();
  }
  return sessionPromise;
}

function softmax(logits) {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  let sum = 0;
  const out = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp(logits[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

async function classifyCell(cellPixels, options = {}) {
  const s = options.session || (await getSession());
  const ort = options.ort || (await loadOrt());
  const input = toMnistTensor(cellPixels, ort);
  const feeds = {};
  feeds[s.inputNames[0] || INPUT_NAME] = input;
  const results = await s.run(feeds);
  const out = results[s.outputNames[0] || OUTPUT_NAME];
  const probs = softmax(Array.from(out.data));
  let best = 0;
  for (let i = 1; i < 10; i++) if (probs[i] > probs[best]) best = i;
  return { digit: best, confidence: probs[best], probs: Array.from(probs) };
}

function toMnistTensor(cellPixels, ort) {
  const data = new Float32Array(1 * 1 * 28 * 28);
  for (let i = 0; i < 28 * 28; i++) data[i] = cellPixels[i];
  return new ort.Tensor("float32", data, [1, 1, 28, 28]);
}

async function readGrid(cells, options = {}) {
  const onCell = options.onCell || null;
  const minInk = options.minInk ?? 0.01;
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const confidences = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (const cell of cells) {
    const ink = options.inkRatio ? options.inkRatio(cell.pixels) : null;
    if (ink !== null && ink < minInk) {
      grid[cell.row][cell.col] = 0;
      if (onCell) onCell(cell.row, cell.col, 0, 0);
      continue;
    }
    const mnistPixels = visionRef.cellToMnistInput(cell.pixels);
    const res = await classifyCell(mnistPixels, options);
    grid[cell.row][cell.col] = res.digit;
    confidences[cell.row][cell.col] = res.confidence;
    if (onCell) onCell(cell.row, cell.col, res.digit, res.confidence);
  }
  return { grid, confidences };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { classifyCell, readGrid, softmax, toMnistTensor, MODEL_URL, getSession };
}
if (typeof window !== "undefined") {
  window.SudokuOCR = { classifyCell, readGrid, softmax, MODEL_URL, getSession };
}
