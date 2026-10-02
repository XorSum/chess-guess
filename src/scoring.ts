import type { MarkedMove, Puzzle, ScoredMark } from './types';

export const EVEN_LINE = 50; // 均势线：胜率 > 50 才得分
export const NOT_IN_BOOK_WINRATE = 30; // 未纳入候选的走法按胜率 30 处理

export function scoreMove(puzzle: Puzzle, uci: string): ScoredMark {
  const found = puzzle.moves.find((m) => m.uci === uci);
  if (!found) {
    return { uci, inBook: false, effectiveWinrate: NOT_IN_BOOK_WINRATE, points: 0 };
  }
  const points = found.winrate > EVEN_LINE ? found.winrate - EVEN_LINE : 0;
  return { uci, inBook: true, effectiveWinrate: found.winrate, points };
}

export function scoreRound(
  puzzle: Puzzle,
  marks: MarkedMove[],
): { items: ScoredMark[]; total: number } {
  const items = marks.map((m) => scoreMove(puzzle, m.uci));
  const total = items.reduce((sum, item) => sum + item.points, 0);
  return { items, total };
}
