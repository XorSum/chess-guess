import type { MarkedMove, Puzzle, ScoredMark } from './types';

export const NOT_IN_BOOK_WINRATE = 30; // 未纳入候选的走法按胜率 30 处理

// 计分：得分 = 走法胜率本身。局面有优劣（劣势局面所有候选都可能 < 50%），
// 不按固定均势线折算，玩家在坏局面下选出相对最优走法同样得分。
export function scoreMove(puzzle: Puzzle, uci: string): ScoredMark {
  const found = puzzle.moves.find((m) => m.uci === uci);
  if (!found) {
    return { uci, inBook: false, effectiveWinrate: NOT_IN_BOOK_WINRATE, points: NOT_IN_BOOK_WINRATE };
  }
  return { uci, inBook: true, effectiveWinrate: found.winrate, points: found.winrate };
}

export function scoreRound(
  puzzle: Puzzle,
  marks: MarkedMove[],
): { items: ScoredMark[]; total: number } {
  const items = marks.map((m) => scoreMove(puzzle, m.uci));
  const total = items.reduce((sum, item) => sum + item.points, 0);
  return { items, total };
}
