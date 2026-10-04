// 棋子显示：字形与配色（与网页版 src/components/Piece.tsx 保持一致）
const RED_NAMES: Record<string, string> = {
  K: '帥',
  A: '仕',
  B: '相',
  R: '俥',
  N: '傌',
  C: '炮',
  P: '兵',
};

const BLACK_NAMES: Record<string, string> = {
  k: '將',
  a: '士',
  b: '象',
  r: '車',
  n: '馬',
  c: '砲',
  p: '卒',
};

export function pieceLabel(piece: string): string {
  return RED_NAMES[piece] ?? BLACK_NAMES[piece] ?? piece;
}

export const PIECE_COLORS = {
  red: '#c92b1f', // 红方字色/描边
  black: '#1d1a16', // 黑方字色/描边
  body: '#f6e7c8', // 棋子底色
  markedFrom: '#ffe9b8', // 被标记起点棋子底色
} as const;
