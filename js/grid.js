const GRID_LINES = 10;

function findLinePeaks(proj, minPeakRatio) {
  const max = Math.max(...proj);
  if (max <= 0) return [];
  const threshold = max * minPeakRatio;
  const peaks = [];
  let inPeak = false;
  let start = 0;
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < proj.length; i++) {
    if (proj[i] >= threshold) {
      if (!inPeak) {
        inPeak = true;
        start = i;
        sum = 0;
        weight = 0;
      }
      sum += proj[i] * i;
      weight += proj[i];
    } else if (inPeak) {
      inPeak = false;
      peaks.push({ start, end: i - 1, center: weight > 0 ? sum / weight : (start + i - 1) / 2 });
    }
  }
  if (inPeak) peaks.push({ start, end: proj.length - 1, center: weight > 0 ? sum / weight : (start + proj.length - 1) / 2 });
  const dense = [];
  for (let i = 0; i < peaks.length; i++) {
    const next = peaks[i + 1];
    if (next && next.start - peaks[i].end <= 3) {
      const w = weight;
      dense.push(peaks[i]);
    } else {
      dense.push(peaks[i]);
    }
  }
  return dense;
}

function localMaxima(proj, minValue) {
  const out = [];
  for (let i = 1; i < proj.length - 1; i++) {
    if (proj[i] >= minValue && proj[i] >= proj[i - 1] && proj[i] >= proj[i + 1]) {
      let j = i;
      while (j + 1 < proj.length && proj[j + 1] === proj[i]) j++;
      out.push((i + j) / 2);
      i = j;
    }
  }
  return out;
}

function mergeClosePeaks(peaks, minGap) {
  if (peaks.length === 0) return [];
  const merged = [peaks[0]];
  for (let i = 1; i < peaks.length; i++) {
    const last = merged[merged.length - 1];
    if (peaks[i].center - last.center < minGap) {
      const w = (last.end - last.start + 1) + (peaks[i].end - peaks[i].start + 1);
      last.center = (last.center * (last.end - last.start + 1) + peaks[i].center * (peaks[i].end - peaks[i].start + 1)) / w;
      last.end = peaks[i].end;
    } else {
      merged.push(peaks[i]);
    }
  }
  return merged;
}

function scoreLineSet(win, size) {
  const first = win[0];
  const last = win[GRID_LINES - 1];
  const span = last - first;
  if (span < size * 0.4) return null;
  const mean = span / (GRID_LINES - 1);
  let sqErr = 0;
  for (let i = 0; i < GRID_LINES; i++) {
    const ideal = first + i * mean;
    sqErr += (win[i] - ideal) ** 2;
  }
  const rms = Math.sqrt(sqErr / GRID_LINES);
  const regularity = 1 / (1 + rms / Math.max(mean * 0.25, 1));
  const coverage = span / size;
  return regularity * (0.5 + coverage) * mean;
}

function selectGridLines(peaks, size, minPeakRatio) {
  if (peaks.length < GRID_LINES) return null;
  let best = null;
  let bestScore = -Infinity;
  const n = peaks.length;
  for (let s = 0; s + GRID_LINES - 1 < n; s++) {
    const win = peaks.slice(s, s + GRID_LINES).map((p) => p.center);
    const score = scoreLineSet(win, size);
    if (score !== null && score > bestScore) {
      bestScore = score;
      best = win;
    }
  }
  if (!best) return null;
  const totalSpan = best[GRID_LINES - 1] - best[0];
  if (totalSpan < size * 0.4) return null;
  return best;
}

function fitGridLines(proj, size) {
  const max = Math.max(...proj);
  if (max <= 0) return null;
  const smoothWin = Math.max(3, Math.round(size / 100));
  const smooth = new Float64Array(proj.length);
  for (let i = 0; i < proj.length; i++) {
    let s = 0;
    let n = 0;
    for (let k = -smoothWin; k <= smoothWin; k++) {
      const j = i + k;
      if (j >= 0 && j < proj.length) {
        s += proj[j];
        n++;
      }
    }
    smooth[i] = s / n;
  }
  const smax = Math.max(...smooth);
  let lo = 0;
  let hi = smooth.length - 1;
  while (lo < smooth.length && smooth[lo] < smax * 0.05) lo++;
  while (hi > 0 && smooth[hi] < smax * 0.05) hi--;
  if (hi - lo < size * 0.4) return null;
  let best = null;
  let bestScore = -Infinity;
  const meanMin = (hi - lo) / 10;
  const meanMax = (hi - lo) / 7;
  for (let mean = meanMin; mean <= meanMax; mean += 1) {
    for (let start = Math.max(0, lo - mean); start <= Math.min(hi, lo + mean); start += 1) {
      const lines = [];
      for (let k = 0; k < GRID_LINES; k++) {
        const c = start + k * mean;
        if (c >= smooth.length) break;
        let bv = -1;
        let bx = Math.round(c);
        const lo = Math.max(1, Math.round(c - mean / 4));
        const hi = Math.min(smooth.length - 2, Math.round(c + mean / 4));
        for (let x = lo; x <= hi; x++) {
          if (smooth[x] > bv) {
            bv = smooth[x];
            bx = x;
          }
        }
        lines.push(bx);
      }
      if (lines.length < GRID_LINES) continue;
      const span = lines[GRID_LINES - 1] - lines[0];
      if (span < size * 0.4) continue;
      const m = span / (GRID_LINES - 1);
      let sq = 0;
      for (let i = 0; i < GRID_LINES; i++) sq += (lines[i] - (lines[0] + i * m)) ** 2;
      const rms = Math.sqrt(sq / GRID_LINES);
      const ink = lines.reduce((a, l) => a + smooth[l], 0);
      const score = ink / (1 + rms / Math.max(m * 0.1, 1));
      if (score > bestScore) {
        bestScore = score;
        best = lines;
      }
    }
  }
  return best;
}

function refineLines(smooth, lines, size) {
  const out = [];
  const win = Math.max(3, Math.round(size / 60));
  for (const c of lines) {
    let bestX = c;
    let bestV = -1;
    for (let x = Math.max(1, Math.round(c - win)); x <= Math.min(smooth.length - 2, Math.round(c + win)); x++) {
      if (smooth[x] > bestV) {
        bestV = smooth[x];
        bestX = x;
      }
    }
    out.push(bestX);
  }
  return out;
}

function detectGridLines(projX, projY, width, height, minPeakRatio) {
  const linesX = pickLines(projX, height, minPeakRatio);
  const linesY = pickLines(projY, width, minPeakRatio);
  if (!linesX || !linesY) return null;
  return { x: linesY, y: linesX };
}

function pickLines(proj, size, minPeakRatio) {
  const max = Math.max(...proj);
  if (max <= 0) return null;
  const smoothWin = Math.max(3, Math.round(size / 100));
  const smooth = new Float64Array(proj.length);
  for (let i = 0; i < proj.length; i++) {
    let s = 0;
    let n = 0;
    for (let k = -smoothWin; k <= smoothWin; k++) {
      const j = i + k;
      if (j >= 0 && j < proj.length) {
        s += proj[j];
        n++;
      }
    }
    smooth[i] = s / n;
  }
  const fitted = fitGridLines(smooth, size);
  if (fitted) return fitted;
  for (const ratio of [minPeakRatio, 0.25, 0.18, 0.12, 0.08]) {
    const peaks = mergeClosePeaks(findLinePeaks(smooth, ratio), Math.max(3, size / 40));
    const direct = selectGridLines(peaks, size, ratio);
    if (direct) return direct;
  }
  const smax = Math.max(...smooth);
  for (const thr of [0.4, 0.3, 0.25, 0.2, 0.15, 0.1]) {
    const maxima = localMaxima(smooth, smax * thr);
    const peaks2 = mergeClosePeaks(maxima.map((c) => ({ start: c, end: c, center: c })), Math.max(3, size / 40));
    const lines = selectGridLines(peaks2, size, thr);
    if (lines) return lines;
  }
  return null;
}

function solveLinear8(a, b) {
  const A = [];
  for (let i = 0; i < 4; i++) {
    const x = a[i][0];
    const y = a[i][1];
    const u = b[i][0];
    const v = b[i][1];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let maxRow = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[maxRow][col])) maxRow = r;
    if (Math.abs(A[maxRow][col]) < 1e-12) return null;
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    const pivot = A[col][col];
    for (let r = col + 1; r < 8; r++) {
      const f = A[r][col] / pivot;
      for (let c = col; c < 9; c++) A[r][c] -= f * A[col][c];
    }
  }
  const h = new Array(8);
  for (let row = 7; row >= 0; row--) {
    let s = A[row][8];
    for (let c = row + 1; c < 8; c++) s -= A[row][c] * h[c];
    h[row] = s / A[row][row];
  }
  return h;
}

function homographyFromCorners(src, dst) {
  return solveLinear8(src, dst);
}

function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

function findGridCorners(lines) {
  return [
    [lines.x[0], lines.y[0]],
    [lines.x[GRID_LINES - 1], lines.y[0]],
    [lines.x[GRID_LINES - 1], lines.y[GRID_LINES - 1]],
    [lines.x[0], lines.y[GRID_LINES - 1]],
  ];
}

const UNIT_SQUARE = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function bilinearSample(img, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = y0 * width + x0;
  const i10 = y0 * width + x1;
  const i01 = y1 * width + x0;
  const i11 = y1 * width + x1;
  const top = img[i00] * (1 - fx) + img[i10] * fx;
  const bottom = img[i01] * (1 - fx) + img[i11] * fx;
  return top * (1 - fy) + bottom * fy;
}

function warpGrid(img, width, height, corners, outSize) {
  const h = homographyFromCorners(UNIT_SQUARE, corners);
  if (!h) return null;
  const out = new Float32Array(outSize * outSize);
  for (let oy = 0; oy < outSize; oy++) {
    for (let ox = 0; ox < outSize; ox++) {
      const [sx, sy] = applyHomography(h, ox / (outSize - 1), oy / (outSize - 1));
      if (sx < 0 || sy < 0 || sx >= width - 1 || sy >= height - 1) {
        out[oy * outSize + ox] = 0;
      } else {
        out[oy * outSize + ox] = bilinearSample(img, width, height, sx, sy);
      }
    }
  }
  return out;
}

function detectGrid(binary, width, height, options = {}) {
  const minPeakRatio = options.minPeakRatio ?? 0.35;
  const projX = new Float64Array(height);
  const projY = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x]) {
        projX[y]++;
        projY[x]++;
      }
    }
  }
  const lines = detectGridLines(projX, projY, width, height, minPeakRatio);
  if (!lines) return null;
  return { lines, corners: findGridCorners(lines) };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    detectGrid,
    detectGridLines,
    pickLines,
    findLinePeaks,
    localMaxima,
    mergeClosePeaks,
    selectGridLines,
    fitGridLines,
    refineLines,
    scoreLineSet,
    homographyFromCorners,
    applyHomography,
    warpGrid,
    bilinearSample,
    findGridCorners,
  };
}
if (typeof window !== "undefined") {
  window.SudokuGrid = {
    detectGrid,
    detectGridLines,
    pickLines,
    findLinePeaks,
    localMaxima,
    mergeClosePeaks,
    selectGridLines,
    fitGridLines,
    refineLines,
    scoreLineSet,
    homographyFromCorners,
    applyHomography,
    warpGrid,
    bilinearSample,
    findGridCorners,
  };
}
