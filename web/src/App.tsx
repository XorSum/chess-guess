import { useEffect, useMemo, useRef, useState } from 'react';
import { PUZZLES } from './puzzles';
import { loadTree, randomPuzzleFromTree, type OpeningTree } from './tree';
import { parseFen, pieceSide, sameSquare, squaresToUci } from '../../core/fen';
import { isLegalMove } from '../../core/rules';
import { scoreRound } from '../../core/scoring';
import Board from './components/Board';
import RevealPanel from './components/RevealPanel';
import type { GamePhase, MarkedMove, Puzzle, Square } from '../../core/types';

const MAX_MARKS = 3;

function randomPuzzle(exceptId?: string): Puzzle {
  const pool = PUZZLES.filter((p) => p.id !== exceptId);
  return pool[Math.floor(Math.random() * pool.length)];
}

// hint 形如"中局 · 黑先 · 红过河炮失根"，第三段会剧透正着，只取前两段
function stageHint(hint?: string): string | null {
  return hint?.split('·').slice(0, 2).join('·').trim() || null;
}

export default function App() {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => randomPuzzle());
  const [phase, setPhase] = useState<GamePhase>('marking');
  const [marks, setMarks] = useState<MarkedMove[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [round, setRound] = useState(1);
  const [flash, setFlash] = useState<Square | null>(null);
  const [treeStatus, setTreeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const treeRef = useRef<OpeningTree | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  // 启动时加载开局树：成功后用树动态出题；失败回退到静态 PUZZLES 保底
  useEffect(() => {
    let cancelled = false;
    loadTree()
      .then((tree) => {
        if (cancelled) return;
        treeRef.current = tree;
        setTreeStatus('ready');
        setPuzzle(randomPuzzleFromTree(tree));
      })
      .catch(() => {
        if (!cancelled) setTreeStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { board, side } = useMemo(() => parseFen(puzzle.fen), [puzzle]);

  // 揭晓后根据标记计算得分明细（纯函数，重复计算无副作用）
  const scored = useMemo(
    () => (phase === 'revealed' ? scoreRound(puzzle, marks) : null),
    [phase, puzzle, marks],
  );

  const ownPieceAt = (sq: Square): boolean => {
    const piece = board[sq.row][sq.col];
    return !!piece && pieceSide(piece) === side;
  };

  // 目标格红闪 ~300ms，提示走法不合法
  function triggerFlash(sq: Square) {
    window.clearTimeout(flashTimer.current);
    setFlash(sq);
    flashTimer.current = window.setTimeout(() => setFlash(null), 300);
  }

  function handleSquareClick(sq: Square) {
    if (phase !== 'marking') return;

    // 点击已标记的目标格：取消该标记
    const markIndex = marks.findIndex((m) => sameSquare(m.to, sq));
    if (markIndex >= 0) {
      setMarks(marks.filter((_, i) => i !== markIndex));
      setSelected(null);
      return;
    }

    if (selected) {
      // 再点一次选中的棋子：取消选中
      if (sameSquare(selected, sq)) {
        setSelected(null);
        return;
      }
      // 点击其他己方棋子：改选
      if (ownPieceAt(sq)) {
        setSelected(sq);
        return;
      }
      // 完整规则校验：不合法则不生成标记，目标格红闪提示
      if (marks.length >= MAX_MARKS) return;
      if (!isLegalMove(board, selected, sq)) {
        triggerFlash(sq);
        return;
      }
      const uci = squaresToUci(selected, sq);
      if (marks.some((m) => m.uci === uci)) {
        setSelected(null);
        return;
      }
      setMarks([...marks, { uci, from: selected, to: sq }]);
      setSelected(null);
      return;
    }

    if (ownPieceAt(sq)) {
      setSelected(sq);
    }
  }

  function handleSubmit() {
    if (phase !== 'marking' || marks.length < 1) return;
    const result = scoreRound(puzzle, marks);
    setTotalScore((t) => t + result.total);
    setPhase('revealed');
  }

  function handleNext() {
    window.clearTimeout(flashTimer.current);
    setPuzzle(
      treeRef.current ? randomPuzzleFromTree(treeRef.current, puzzle.fen) : randomPuzzle(puzzle.id),
    );
    setMarks([]);
    setSelected(null);
    setFlash(null);
    setPhase('marking');
    setRound((r) => r + 1);
  }

  // 主操作栏：提交/下一题永远在同一位置（棋盘正下方），随阶段切换功能
  const actionStatus =
    phase === 'marking'
      ? selected
        ? '点击目标格完成标记 · 点已标目标格可取消'
        : marks.length > 0
          ? `已标 ${marks.length}/${MAX_MARKS} · 可继续标记或提交`
          : `点击${side === 'red' ? '红' : '黑'}方棋子开始标记`
      : `本题得分 +${scored?.total ?? 0}`;

  if (treeStatus === 'loading') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>象棋扫雷</h1>
        </header>
        <main className="app-main">
          <div className="loading-hint">加载开局树…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>象棋扫雷</h1>
        <div className="header-stats">
          <span>第 {round} 题</span>
          {stageHint(puzzle.hint) && <span className="header-hint">{stageHint(puzzle.hint)}</span>}
          <span>总分 {totalScore}</span>
        </div>
      </header>

      {treeStatus === 'error' && (
        <div className="tree-error">开局树加载失败，已回退到内置题库</div>
      )}

      <main className="app-main">
        <div className="board-column">
          <Board
            board={board}
            side={side}
            phase={phase}
            selected={selected}
            marks={marks}
            flash={flash}
            onSquareClick={handleSquareClick}
          />
          <div className="action-bar">
            <span
              className={
                phase === 'revealed' ? 'action-status action-score' : 'action-status'
              }
            >
              {actionStatus}
            </span>
            {phase === 'marking' ? (
              <button
                className="primary-btn"
                disabled={marks.length < 1}
                onClick={handleSubmit}
              >
                提交
              </button>
            ) : (
              <button className="primary-btn" onClick={handleNext} autoFocus>
                下一题
              </button>
            )}
          </div>
        </div>

        {phase === 'revealed' && scored && (
          <RevealPanel puzzle={puzzle} scoredItems={scored.items} />
        )}
      </main>
    </div>
  );
}
