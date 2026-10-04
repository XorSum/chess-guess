import type { Board, Side, Square } from './types';

// FEN 棋子字母：大写红方，小写黑方
// K/k 帅将 A/a 仕士 B/b 相象 R/r 车 N/n 马 C/c 炮 P/p 兵卒

export interface ParsedFen {
  board: Board;
  side: Side;
}

export function parseFen(fen: string): ParsedFen {
  const parts = fen.trim().split(/\s+/);
  const placement = parts[0];
  const sideToken = parts[1] ?? 'w';
  const rows = placement.split('/');
  if (rows.length !== 10) {
    throw new Error(`非法 FEN：应有 10 行，实际 ${rows.length} 行（${fen}）`);
  }
  const board: Board = rows.map((rowStr) => {
    const row: (string | null)[] = [];
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '9') {
        for (let i = 0; i < Number(ch); i++) row.push(null);
      } else if ('kabnrpcKABNRPC'.includes(ch)) {
        row.push(ch);
      } else {
        throw new Error(`非法 FEN 字符：${ch}（${fen}）`);
      }
    }
    if (row.length !== 9) {
      throw new Error(`非法 FEN：某行展开后不是 9 列（${rowStr}）`);
    }
    return row;
  });
  return { board, side: sideToken === 'b' ? 'black' : 'red' };
}

export function isRedPiece(piece: string): boolean {
  return piece === piece.toUpperCase();
}

export function pieceSide(piece: string): Side {
  return isRedPiece(piece) ? 'red' : 'black';
}

// UCI 走法格式：列 a-i（红方视角从左到右），横线 0-9。
// 注意：rank 0 对应红方底线（board row 9），rank 9 对应黑方底线（board row 0），
// 与 Pikafish/ElephantFish 一致，例如开局右炮平中为 h2e2。
const FILE_A = 'a'.charCodeAt(0);
const RANK_0 = '0'.charCodeAt(0);

export function uciToSquares(uci: string): { from: Square; to: Square } {
  if (uci.length !== 4) throw new Error(`非法 UCI：${uci}`);
  const from: Square = {
    col: uci.charCodeAt(0) - FILE_A,
    row: 9 - (uci.charCodeAt(1) - RANK_0),
  };
  const to: Square = {
    col: uci.charCodeAt(2) - FILE_A,
    row: 9 - (uci.charCodeAt(3) - RANK_0),
  };
  for (const sq of [from, to]) {
    if (sq.col < 0 || sq.col > 8 || sq.row < 0 || sq.row > 9) {
      throw new Error(`UCI 越界：${uci}`);
    }
  }
  return { from, to };
}

export function squaresToUci(from: Square, to: Square): string {
  return (
    String.fromCharCode(FILE_A + from.col) +
    String(9 - from.row) +
    String.fromCharCode(FILE_A + to.col) +
    String(9 - to.row)
  );
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

// 走法合法性校验见 src/rules.ts（兵种规则 + 送将/照面检查）
