const CELL_SIZE = 28;
const GRID_PIXELS = 9 * CELL_SIZE;

function rgbaToGray(data, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

function boxBlur(src, width, height, radius) {
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  const size = 2 * radius + 1;
  for (let y = 0; y < height; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * width + Math.min(width - 1, Math.max(0, x))];
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = acc / size;
      const xa = Math.min(width - 1, x + radius + 1);
      const xs = Math.max(0, x - radius);
      acc += src[y * width + xa] - src[y * width + xs];
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(height - 1, Math.max(0, y)) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc / size;
      const ya = Math.min(height - 1, y + radius + 1);
      const ys = Math.max(0, y - radius);
      acc += tmp[ya * width + x] - tmp[ys * width + x];
    }
  }
  return out;
}

function adaptiveThreshold(gray, width, height, blockRatio = 1 / 16, offset = 12) {
  const radius = Math.max(4, Math.floor(Math.min(width, height) * blockRatio / 2));
  const bg = boxBlur(gray, width, height, radius);
  const bin = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    bin[i] = gray[i] < bg[i] - offset ? 1 : 0;
  }
  return bin;
}

function extractCells(warped, warpSize, marginRatio = 0.22) {
  const cells = [];
  const cellSize = warpSize / 9;
  const margin = cellSize * marginRatio;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const x0 = Math.floor(c * cellSize + margin);
      const y0 = Math.floor(r * cellSize + margin);
      const size = Math.floor(cellSize - 2 * margin);
      const cell = new Float32Array(CELL_SIZE * CELL_SIZE);
      for (let y = 0; y < CELL_SIZE; y++) {
        const sy = y0 + (y / (CELL_SIZE - 1)) * (size - 1);
        for (let x = 0; x < CELL_SIZE; x++) {
          const sx = x0 + (x / (CELL_SIZE - 1)) * (size - 1);
          cell[y * CELL_SIZE + x] = sampleBilinear(warped, warpSize, warpSize, sx, sy);
        }
      }
      cells.push({ row: r, col: c, pixels: cell });
    }
  }
  return cells;
}

function sampleBilinear(img, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const top = img[y0 * width + x0] * (1 - fx) + img[y0 * width + x1] * fx;
  const bottom = img[y1 * width + x0] * (1 - fx) + img[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

function cellInkRatio(cellPixels) {
  let dark = 0;
  for (let i = 0; i < cellPixels.length; i++) if (cellPixels[i] < 128) dark++;
  return dark / cellPixels.length;
}

function cellToMnistInput(cellPixels) {
  const size = CELL_SIZE;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  let minV = 255, maxV = 0;
  const darkThresh = (() => {
    let min = 255;
    let max = 0;
    for (let i = 0; i < cellPixels.length; i++) {
      if (cellPixels[i] < min) min = cellPixels[i];
      if (cellPixels[i] > max) max = cellPixels[i];
    }
    return min + (max - min) * 0.5;
  })();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = cellPixels[y * size + x];
      if (v < darkThresh) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  const out = new Float32Array(size * size);
  if (maxX < 0) return out;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const scale = Math.min(20 / Math.max(bw, 1), 20 / Math.max(bh, 1));
  const dw = Math.round(bw * scale);
  const dh = Math.round(bh * scale);
  const ox = Math.round((size - dw) / 2);
  const oy = Math.round((size - dh) / 2);
  const range = Math.max(maxV - minV, 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = minX + (x - ox) / scale;
      const sy = minY + (y - oy) / scale;
      let v = maxV;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        v = sampleBilinear(cellPixels, size, size, sx, sy);
      }
      out[y * size + x] = (255 - v) / range;
    }
  }
  return out;
}

function preprocessPhoto(rgba, width, height) {
  const gray = rgbaToGray(rgba, width, height);
  const bin = adaptiveThreshold(gray, width, height);
  return { gray, bin };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CELL_SIZE,
    GRID_PIXELS,
    rgbaToGray,
    boxBlur,
    adaptiveThreshold,
    extractCells,
    sampleBilinear,
    cellInkRatio,
    cellToMnistInput,
    preprocessPhoto,
  };
}
if (typeof window !== "undefined") {
  window.SudokuVision = {
    CELL_SIZE,
    GRID_PIXELS,
    rgbaToGray,
    boxBlur,
    adaptiveThreshold,
    extractCells,
    sampleBilinear,
    cellInkRatio,
    cellToMnistInput,
    preprocessPhoto,
  };
}
