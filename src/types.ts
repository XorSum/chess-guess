// 中国象棋坐标：棋盘为 9 列 x 10 行，row 0 在棋盘上方（黑方底线一侧），row 9 在下方（红方底线）
export interface Square {
  row: number; // 0-9
  col: number; // 0-8
}

export type Side = 'red' | 'black';

export type Board = (string | null)[][]; // board[row][col]，row 0-9，col 0-8

export type GamePhase = 'marking' | 'revealed';

export interface CandidateMove {
  uci: string;
  winrate: number; // 0-100，行棋方视角；树数据为贝叶斯收缩后的胜率
  count?: number; // 该走法在棋谱中的对局数（树数据提供）
  raw?: number; // 裸胜率（未收缩，树数据提供）
}

export interface Puzzle {
  id: string;
  fen: string; // 中国象棋标准 FEN，含行棋方
  hint?: string;
  moves: CandidateMove[]; // 候选走法，按胜率降序
  positionTotal?: number; // 局面在棋谱中的总局数（树题目提供，用于选择率）
}

export interface MarkedMove {
  uci: string;
  from: Square;
  to: Square;
}

export interface ScoredMark {
  uci: string;
  inBook: boolean; // 是否在题库候选走法中
  effectiveWinrate: number; // 未纳入候选时按 30 处理
  points: number;
}
