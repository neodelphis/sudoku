const assert = require("node:assert");
const { solveSudoku, isValidPuzzle, countSolutions } = require("../js/solver.js");

const empty = Array.from({ length: 9 }, () => Array(9).fill(0));

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

const expectedSolution = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

let r = solveSudoku(puzzle);
assert.strictEqual(r.ok, true, "puzzle classique résoluble");
assert.deepStrictEqual(r.solution, expectedSolution, "solution correcte");
assert.deepStrictEqual(r.grid, puzzle, "grille d'origine préservée");

r = solveSudoku(empty);
assert.strictEqual(r.ok, true, "grille vide résoluble");
assert.strictEqual(countSolutions(puzzle), 1, "puzzle classique a une solution unique");
assert.strictEqual(countSolutions(empty, 2), 2, "grille vide a plusieurs solutions");

const conflict = puzzle.map((row) => row.slice());
conflict[0][1] = 5;
assert.strictEqual(isValidPuzzle(conflict), false, "conflit ligne détecté");
assert.strictEqual(solveSudoku(conflict).ok, false);

const impossible = puzzle.map((row) => row.slice());
impossible[0][2] = 5;
assert.strictEqual(solveSudoku(impossible).reason, "invalide");

assert.throws(() => solveSudoku([[1]]), /9x9/);
assert.throws(() => solveSudoku(empty.map((row) => row.map(() => 10))), /9x9/);

console.log("solver.test.js: tous les tests passent");
