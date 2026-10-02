import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Puzzle, ScoredMark } from '../types';
import { parseFen } from '../fen';
import { uciToChinese } from '../notation';

interface RevealPanelProps {
  puzzle: Puzzle;
  scoredItems: ScoredMark[]; // 玩家标记的走法得分明细
}

function barClass(winrate: number): string {
  if (winrate > 65) return 'bar bar-good';
  if (winrate > 50) return 'bar bar-ok';
  if (winrate >= 35) return 'bar bar-mediocre';
  return 'bar bar-bad';
}

// 纯信息展示：走法胜率列表。不含任何操作按钮——主操作（下一题）在棋盘下的固定操作栏
export default function RevealPanel({ puzzle, scoredItems }: RevealPanelProps) {
  const { board, side } = useMemo(() => parseFen(puzzle.fen), [puzzle]);
  const markedUcis = new Map(scoredItems.map((s) => [s.uci, s]));
  const notInBook = scoredItems.filter((s) => !s.inBook);

  return (
    <div className="reveal-panel">
      <h2>胜率揭晓{puzzle.hint && <span className="reveal-title-hint">{puzzle.hint}</span>}</h2>
      <ul className="reveal-list">
        {puzzle.moves.map((m) => {
          const mark = markedUcis.get(m.uci);
          return (
            <li key={m.uci} className={mark ? 'reveal-item reveal-marked' : 'reveal-item'}>
              <div className="reveal-row">
                <span className="reveal-move">
                  {uciToChinese(m.uci, board, side)}
                  <span className="reveal-uci">{m.uci}</span>
                  {m.count != null && puzzle.positionTotal != null && (
                    <span className="reveal-uci">
                      选择率 {Math.round((m.count / puzzle.positionTotal) * 100)}%
                    </span>
                  )}
                </span>
                <span className="reveal-winrate">{m.winrate}%</span>
                {mark && (
                  <span className={mark.points > 0 ? 'reveal-points' : 'reveal-points zero'}>
                    {mark.points > 0 ? `+${mark.points}分` : '0分'}
                  </span>
                )}
              </div>
              <div className="bar-track">
                <div
                  className={barClass(m.winrate)}
                  style={{ '--target-w': `${m.winrate}%` } as CSSProperties}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {notInBook.length > 0 && (
        <div className="not-in-book">
          <h3>未纳入候选</h3>
          {notInBook.map((s) => (
            <div key={s.uci} className="not-in-book-row">
              <span>
                {uciToChinese(s.uci, board, side)}
                <span className="reveal-uci">{s.uci}</span>
              </span>
              <span className="reveal-points zero">按胜率 30 处理 · 0分</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
