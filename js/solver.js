const N = 9;
const EMPTY = 0;

function validGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== N) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== N) return false;
    for (const v of row) if (!Number.isInteger(v) || v < 0 || v > 9) return false;
  }
  return true;
}

function isSafe(grid, r, c, v) {
  for (let i = 0; i < N; i++) {
    if (grid[r][i] === v || grid[i][c] === v) return false;
  }
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (grid[br + i][bc + j] === v) return false;
  return true;
}

function findEmpty(grid) {
  let best = null;
  let bestCount = 10;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === EMPTY) {
        let count = 0;
        for (let v = 1; v <= 9; v++) if (isSafe(grid, r, c, v)) count++;
        if (count === 0) return { r, c, count: 0 };
        if (count < bestCount) {
          bestCount = count;
          best = { r, c, count };
          if (count === 1) return best;
        }
      }
    }
  }
  return best;
}

function solve(grid) {
  const empty = findEmpty(grid);
  if (!empty) return true;
  if (empty.count === 0) return false;
  for (let v = 1; v <= 9; v++) {
    if (isSafe(grid, empty.r, empty.c, v)) {
      grid[empty.r][empty.c] = v;
      if (solve(grid)) return true;
      grid[empty.r][empty.c] = EMPTY;
    }
  }
  return false;
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function isValidPuzzle(grid) {
  if (!validGrid(grid)) return false;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = grid[r][c];
      if (v !== EMPTY) {
        grid[r][c] = EMPTY;
        const ok = isSafe(grid, r, c, v);
        grid[r][c] = v;
        if (!ok) return false;
      }
    }
  }
  return true;
}

function solveSudoku(input) {
  if (!validGrid(input)) throw new Error("La grille doit être 9x9 avec des valeurs de 0 à 9");
  if (!isValidPuzzle(input)) return { ok: false, reason: "invalide", grid: null, solution: null };
  const grid = cloneGrid(input);
  const ok = solve(grid);
  if (!ok) return { ok: false, reason: "insoluble", grid: null, solution: null };
  return { ok: true, reason: null, grid: cloneGrid(input), solution: grid };
}

function countSolutions(input, limit = 2) {
  const grid = cloneGrid(input);
  let count = 0;
  function rec() {
    if (count >= limit) return;
    const empty = findEmpty(grid);
    if (!empty) {
      count++;
      return;
    }
    for (let v = 1; v <= 9; v++) {
      if (isSafe(grid, empty.r, empty.c, v)) {
        grid[empty.r][empty.c] = v;
        rec();
        grid[empty.r][empty.c] = EMPTY;
        if (count >= limit) return;
      }
    }
  }
  rec();
  return count;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { solveSudoku, isValidPuzzle, countSolutions, cloneGrid, validGrid };
}
if (typeof window !== "undefined") {
  window.SudokuSolver = { solveSudoku, isValidPuzzle, countSolutions, cloneGrid, validGrid };
}
