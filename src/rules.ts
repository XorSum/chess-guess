import type { Board, Side, Square } from './types';
import { pieceSide } from './fen';

function inBoard(row: number, col: number): boolean {
  return row >= 0 && row <= 9 && col >= 0 && col <= 8;
}

function inPalace(row: number, col: number, side: Side): boolean {
  if (col < 3 || col > 5) return false;
  return side === 'red' ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
}

// 过河：红方走到 row<=4（黑方半场），黑方走到 row>=5
function crossedRiver(row: number, side: Side): boolean {
  return side === 'red' ? row <= 4 : row >= 5;
}

// 直线两点之间的棋子数（不含端点），调用前需保证同列或同行
function countBetween(board: Board, from: Square, to: Square): number {
  let count = 0;
  if (from.col === to.col) {
    const [lo, hi] = from.row < to.row ? [from.row, to.row] : [to.row, from.row];
    for (let r = lo + 1; r < hi; r++) if (board[r][from.col]) count++;
  } else if (from.row === to.row) {
    const [lo, hi] = from.col < to.col ? [from.col, to.col] : [to.col, from.col];
    for (let c = lo + 1; c < hi; c++) if (board[from.row][c]) count++;
  }
  return count;
}

// 兵种走法规则（不含"送将"检查）
export function isPseudoLegalMove(board: Board, from: Square, to: Square): boolean {
  if (!inBoard(to.row, to.col)) return false;
  const piece = board[from.row][from.col];
  if (!piece) return false;
  if (from.row === to.row && from.col === to.col) return false;
  const side = pieceSide(piece);
  const target = board[to.row][to.col];
  if (target && pieceSide(target) === side) return false;

  const type = piece.toUpperCase();
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  switch (type) {
    case 'R': // 车：直线，路径无子
      if (dr !== 0 && dc !== 0) return false;
      return countBetween(board, from, to) === 0;

    case 'C': // 炮：不吃子路径无子；吃子恰好隔一子（炮架）
      if (dr !== 0 && dc !== 0) return false;
      return target ? countBetween(board, from, to) === 1 : countBetween(board, from, to) === 0;

    case 'N': {
      // 马：日字，别马腿
      if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
      const legRow = adr === 2 ? from.row + dr / 2 : from.row;
      const legCol = adc === 2 ? from.col + dc / 2 : from.col;
      return !board[legRow][legCol];
    }

    case 'B': // 相/象：田字，塞象眼，不可过河
      if (adr !== 2 || adc !== 2) return false;
      if (board[from.row + dr / 2][from.col + dc / 2]) return false;
      return !crossedRiver(to.row, side);

    case 'A': // 仕/士：九宫内斜走一格
      return adr === 1 && adc === 1 && inPalace(to.row, to.col, side);

    case 'K': // 帅/将：九宫内直走一格
      return adr + adc === 1 && inPalace(to.row, to.col, side);

    case 'P': {
      // 兵/卒：不可后退；未过河只能向前一格，过河后可横向一格
      const forward = side === 'red' ? -1 : 1;
      if (dr === forward && dc === 0) return true;
      return crossedRiver(from.row, side) && dr === 0 && adc === 1;
    }

    default:
      return false;
  }
}

function findKing(board: Board, side: Side): Square | null {
  const king = side === 'red' ? 'K' : 'k';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === king) return { row: r, col: c };
    }
  }
  return null;
}

// 将帅照面：双方将帅同列且中间无子
export function isKingsFacing(board: Board): boolean {
  const redKing = findKing(board, 'red');
  const blackKing = findKing(board, 'black');
  if (!redKing || !blackKing || redKing.col !== blackKing.col) return false;
  return countBetween(board, redKing, blackKing) === 0;
}

// 判断 side 方的将/帅是否正被攻击（含将帅照面）
export function isKingAttacked(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return true;
  if (isKingsFacing(board)) return true;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && pieceSide(piece) !== side) {
        if (isPseudoLegalMove(board, { row: r, col: c }, king)) return true;
      }
    }
  }
  return false;
}

// 完整合法性：兵种规则 + 走完后己方将/帅不被攻击（含不照面）
export function isLegalMove(board: Board, from: Square, to: Square): boolean {
  if (!isPseudoLegalMove(board, from, to)) return false;
  const piece = board[from.row][from.col];
  if (!piece) return false;
  const side = pieceSide(piece);
  const next = board.map((row) => row.slice());
  next[to.row][to.col] = piece;
  next[from.row][from.col] = null;
  return !isKingAttacked(next, side);
}
