/**
 * Thirty of the 2,644 positions that need 11 moves, the most any 2×2 position needs.
 * Each is written as the moves that make it from solved. They were picked offline by the
 * Galois solver lab, so the app never has to scan every position to find one.
 */
export const HARDEST: readonly string[] = [
  "F R' F' U2 F U' F2 R F2 R' U2",
  "R' U F R2 U R F2 R2 U' R' U'",
  "R' F' U2 R2 F U' F U F2 R2 U'",
  "F R U2 F' U R2 U' R U' R' U'",
  "U' R' U R2 F' R' U' F2 U' R' U'",
  "U R' F R2 U2 F R F' U R' U'",
  "F R' U' F' U2 R2 F U' F R' U'",
  "R F2 U' R U R' U F2 R2 F' U'",
  "R2 F2 R U' R U R2 U' F R2 U'",
  "U2 F2 U R' U' F2 U' R U R' U'",
  "U' F R' F' U' R2 F R' U2 R U'",
  "R2 U F' R2 F U' F' U' R F' U'",
  "U2 R F' R U' R F' R' U2 R2 U'",
  "F2 U2 F R' F R F2 U' F R' U'",
  "R2 U R' U' F' R2 U2 F U R2 U'",
  "U' F2 U R2 F' R F R' F R U'",
  "F' U2 F R2 F' R U' F R2 F' U'",
  "F2 R' F2 R' F U' F' R2 U2 R' U'",
  "F U2 F' R U R F' R2 U R' U'",
  "F2 U F' U' F2 U' F R' F R2 U'",
  "U R' U' F U2 R' U R' U' R2 U'",
  "F U2 R' F' U R2 U' F2 U2 R' U'",
  "U R U' R2 F2 U' R' F U2 R' U'",
  "R2 F' R2 F2 U R' U' F U R' U'",
  "F R' U2 F' U R U R2 U F' U2",
  "F' R U' R2 U' F' R' U F2 R U'",
  "U R' U2 R' F' U' F' U2 F' R2 U'",
  "F' U2 R U' R' F' U2 F2 R F' U'",
  "R2 U R' F R2 U' F' R2 F' R2 U'",
  "F2 R F2 U' R U2 R2 U' F R2 U'",
]
