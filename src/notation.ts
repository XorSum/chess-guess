import type { Board, Side } from './types';
import { pieceSide, uciToSquares } from './fen';

// 中文记谱的列编号：
// 红方用中文数字 一~九，从红方视角右往左数（红方最右边一路 = 一，即 col 8）
// 黑方用阿拉伯数字 1~9，从黑方视角右往左数（黑方最右边一路 = 1，即 col 0）
// 移动格数同理：红方中文数字，黑方阿拉伯数字。
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 记谱用字：按标准棋谱习惯（与断言样例一致：炮二平五 / 马八进七 / 炮8平5）
const NOTATION_NAME: Record<string, Record<Side, string>> = {
  K: { red: '帅', black: '将' },
  A: { red: '仕', black: '士' },
  B: { red: '相', black: '象' },
  R: { red: '车', black: '车' },
  N: { red: '马', black: '马' },
  C: { red: '炮', black: '炮' },
  P: { red: '兵', black: '卒' },
};

// 直线移动子（进/退 + 格数，平 + 列号）；其余（马、仕/士、相/象）为进/退 + 目标列号
const STRAIGHT_MOVERS = new Set(['R', 'C', 'P', 'K']);

function fileLabel(col: number, side: Side): string {
  return side === 'red' ? CN_NUM[8 - col] : String(col + 1);
}

function numLabel(n: number, side: Side): string {
  return side === 'red' ? CN_NUM[n - 1] : String(n);
}

export function uciToChinese(uci: string, board: Board, side: Side): string {
  const { from, to } = uciToSquares(uci);
  const piece = board[from.row][from.col];
  if (!piece || pieceSide(piece) !== side) return uci; // 非法走法兜底：原样返回

  const type = piece.toUpperCase();
  const name = NOTATION_NAME[type][side];

  // 同列同名双子：改用 前/后 前缀（前进方向上靠前的是"前"）。
  // 红方前进方向是 row 减小，黑方相反。兵/卒三个以上同列的极端情况 fallback 用列号。
  const sameFileRows: number[] = [];
  for (let r = 0; r < 10; r++) {
    const p = board[r][from.col];
    if (p && pieceSide(p) === side && p.toUpperCase() === type) {
      sameFileRows.push(r);
    }
  }
  let subject: string;
  if (sameFileRows.length === 2) {
    const frontRow = side === 'red' ? Math.min(...sameFileRows) : Math.max(...sameFileRows);
    subject = (from.row === frontRow ? '前' : '后') + name;
  } else {
    subject = name + fileLabel(from.col, side);
  }

  // 红方"进"朝黑方底线（row 减小），黑方相反
  const advancing = side === 'red' ? to.row < from.row : to.row > from.row;
  const dir = advancing ? '进' : '退';

  if (STRAIGHT_MOVERS.has(type)) {
    if (to.row === from.row) {
      return `${subject}平${fileLabel(to.col, side)}`;
    }
    if (to.col === from.col) {
      return `${subject}${dir}${numLabel(Math.abs(to.row - from.row), side)}`;
    }
  }
  // 马、仕/士、相/象（以及异常走法兜底）：进/退 + 目标列号
  return `${subject}${dir}${fileLabel(to.col, side)}`;
}
