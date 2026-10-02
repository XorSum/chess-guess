// 开局树构建：npx tsx scripts/build-opening-tree.ts
// 与 build-opening-puzzles.ts 相同的棋谱统计管线，差异：
// 1) 贝叶斯收缩：winrate = round((score + k×0.5) / (count + k) × 100)，k=50，低频走法向 50% 收缩
// 2) 输出树文件 public/opening-tree.json（静态资源走 fetch，不进 bundle）
// 每个走法含 winrate（收缩后，计分用）、count（对局数）、raw（裸胜率）。
import { createReadStream, writeFileSync } from 'node:fs';
import readline from 'node:readline';
import { parseFen, uciToSquares, pieceSide } from '../src/fen';
import { isLegalMove } from '../src/rules';
import type { Board, Side, Square } from '../src/types';

const INPUTS = ['data/games/wxf.jsonl', 'data/games/dongping.jsonl'];
const OUTPUT = 'public/opening-tree.json';

const MAX_PLY = 20; // 前 10 回合
const MIN_POSITION_GAMES = 30; // 节点入选：局面总局数
const MIN_MOVE_COUNT = 5; // 节点内走法最少对局数
const MAX_MOVES = 10; // 节点内最多保留走法数
export const PRIOR_K = 50; // 贝叶斯收缩强度（先验：k 局 50% 胜率）
export const MIN_CANDIDATE_MOVES = 4; // 题目合格条件：count≥5 的走法数

function applyMove(board: Board, from: Square, to: Square): void {
  board[to.row][to.col] = board[from.row][from.col];
  board[from.row][from.col] = null;
}

// 局面 key：FEN 棋局部分 + 行棋方（如 "...RNBAKABNR w"），也是树节点的键
function positionKey(board: Board, side: Side): string {
  const rows = board.map((row) => {
    let s = '';
    let empty = 0;
    for (const cell of row) {
      if (cell) {
        if (empty > 0) {
          s += empty;
          empty = 0;
        }
        s += cell;
      } else {
        empty++;
      }
    }
    if (empty > 0) s += empty;
    return s;
  });
  return rows.join('/') + (side === 'red' ? ' w' : ' b');
}

// result 从行棋方视角换算得分
function scoreOf(result: string, side: Side): number | null {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return side === 'red' ? 1 : 0;
  if (result === '0-1') return side === 'black' ? 1 : 0;
  return null;
}

interface MoveStat {
  count: number;
  score: number;
}

async function main() {
  // map[局面key] → map[uci] → {count, score}
  const positions = new Map<string, Map<string, MoveStat>>();
  let games = 0;
  let skippedIllegal = 0;
  let skippedResult = 0;

  for (const input of INPUTS) {
    const rl = readline.createInterface({ input: createReadStream(input), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const game = JSON.parse(line) as { fen: string; result: string; moves: string[] };
      games++;
      let board: Board;
      let side: Side;
      try {
        ({ board, side } = parseFen(game.fen));
      } catch {
        skippedIllegal++;
        continue;
      }
      // 重放并校验（非法局整局丢弃，与 validate-games.ts 口径一致）
      let legal = true;
      const startSide = side;
      const keys: string[] = [];
      for (let i = 0; i < game.moves.length; i++) {
        let from: Square, to: Square;
        try {
          ({ from, to } = uciToSquares(game.moves[i]));
        } catch {
          legal = false;
          break;
        }
        const piece = board[from.row][from.col];
        if (!piece || pieceSide(piece) !== side || !isLegalMove(board, from, to)) {
          legal = false;
          break;
        }
        if (i < MAX_PLY) keys.push(positionKey(board, side));
        applyMove(board, from, to);
        side = side === 'red' ? 'black' : 'red';
      }
      if (!legal) {
        skippedIllegal++;
        continue;
      }
      if (scoreOf(game.result, 'red') === null) {
        skippedResult++;
        continue;
      }
      // 累积前 20 ply 的局面统计
      let s: Side = startSide;
      for (let i = 0; i < keys.length; i++) {
        const score = scoreOf(game.result, s)!;
        let moves = positions.get(keys[i]);
        if (!moves) {
          moves = new Map();
          positions.set(keys[i], moves);
        }
        const uci = game.moves[i];
        const stat = moves.get(uci) ?? { count: 0, score: 0 };
        stat.count++;
        stat.score += score;
        moves.set(uci, stat);
        s = s === 'red' ? 'black' : 'red';
      }
    }
  }

  // 成型树节点
  const nodes: Record<string, { total: number; moves: { uci: string; winrate: number; count: number; raw: number }[] }> = {};
  let eligible = 0;
  for (const [key, moves] of positions) {
    const total = [...moves.values()].reduce((a, s) => a + s.count, 0);
    if (total < MIN_POSITION_GAMES) continue;
    const list = [...moves.entries()]
      .filter(([, s]) => s.count >= MIN_MOVE_COUNT)
      .map(([uci, s]) => ({
        uci,
        winrate: Math.round(((s.score + PRIOR_K * 0.5) / (s.count + PRIOR_K)) * 100),
        count: s.count,
        raw: Math.round((s.score / s.count) * 100),
      }))
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, MAX_MOVES);
    if (list.length === 0) continue;
    nodes[key] = { total, moves: list };
    if (list.length >= MIN_CANDIDATE_MOVES) eligible++;
  }

  const tree = {
    version: 1,
    priorK: PRIOR_K,
    minPositionGames: MIN_POSITION_GAMES,
    minMoveCount: MIN_MOVE_COUNT,
    minCandidateMoves: MIN_CANDIDATE_MOVES, // 题目合格条件：节点内走法数 ≥ 此值
    nodes,
  };
  writeFileSync(OUTPUT, JSON.stringify(tree));

  const { size } = await import('node:fs').then((fs) => fs.statSync(OUTPUT));
  console.log(`对局：${games}，非法跳过 ${skippedIllegal}，无结果跳过 ${skippedResult}`);
  console.log(`节点数（局面 ≥${MIN_POSITION_GAMES} 局）：${Object.keys(nodes).length}`);
  console.log(`合格节点数（走法 ≥${MIN_CANDIDATE_MOVES} 个）：${eligible}`);
  console.log(`输出 ${OUTPUT}：${(size / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
