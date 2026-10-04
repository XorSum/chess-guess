// 开局树校验：npx tsx pipeline/checks/check-opening-tree.ts [opening-tree.json 路径]
// 抽 100 个合格节点检查：FEN 合法（将帅各一、不照面）、走法在完整规则下合法且属行棋方、
// 收缩胜率降序。另专项检查初始局面与"炮二平五后黑先"两个节点的走法表。
import { readFileSync } from 'node:fs';
import { parseFen, uciToSquares, pieceSide } from '../../core/fen';
import { isLegalMove, isKingsFacing } from '../../core/rules';
import { uciToChinese } from '../../core/notation';
import type { OpeningTree } from '../../core/tree-core';
import type { Board, Square } from '../../core/types';

const path = process.argv[2] ?? 'web/public/opening-tree.json';
const tree = JSON.parse(readFileSync(path, 'utf8')) as OpeningTree;

const START_KEY = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

function applyMove(board: Board, from: Square, to: Square): void {
  board[to.row][to.col] = board[from.row][from.col];
  board[from.row][from.col] = null;
}

// 初始局面走红方 uci 后的局面 key
function keyAfter(uci: string): string {
  const { board } = parseFen(`${START_KEY} - - 0 1`);
  const { from, to } = uciToSquares(uci);
  applyMove(board, from, to);
  return board
    .map((row) => {
      let s = '';
      let empty = 0;
      for (const cell of row) {
        if (cell) {
          if (empty > 0) {
            s += empty;
            empty = 0;
          }
          s += cell;
        } else empty++;
      }
      if (empty > 0) s += empty;
      return s;
    })
    .join('/');
}

let failures = 0;
function fail(ctx: string, msg: string) {
  failures++;
  console.log(`  ✗ [${ctx}] ${msg}`);
}

// 均匀抽 100 个合格节点
const minMoves = tree.minCandidateMoves ?? 4;
const eligible = Object.keys(tree.nodes).filter((k) => tree.nodes[k].moves.length >= minMoves);
const step = Math.max(1, Math.floor(eligible.length / 100));
const sample = eligible.filter((_, i) => i % step === 0).slice(0, 100);

console.log(`校验 ${path}：节点 ${Object.keys(tree.nodes).length}，合格 ${eligible.length}，抽样 ${sample.length}`);
for (const key of sample) {
  const node = tree.nodes[key];
  let board, side;
  try {
    ({ board, side } = parseFen(`${key} - - 0 1`));
  } catch (e) {
    fail(key, `FEN 解析失败：${(e as Error).message}`);
    continue;
  }
  const flat = board.flat();
  if (flat.filter((x) => x === 'K').length !== 1 || flat.filter((x) => x === 'k').length !== 1) {
    fail(key, '将帅数量异常');
  }
  if (isKingsFacing(board)) fail(key, '将帅照面');
  for (let i = 0; i < node.moves.length; i++) {
    const m = node.moves[i];
    if (i > 0 && node.moves[i - 1].winrate < m.winrate) {
      fail(key, `胜率未降序：${node.moves[i - 1].uci} ${node.moves[i - 1].winrate} < ${m.uci} ${m.winrate}`);
    }
    const { from, to } = uciToSquares(m.uci);
    const piece = board[from.row][from.col];
    if (!piece) fail(key, `${m.uci} 起点无子`);
    else if (pieceSide(piece) !== side) fail(key, `${m.uci} 非行棋方（${side}）的子`);
    else if (!isLegalMove(board, from, to)) fail(key, `${m.uci} 不符合走法规则`);
  }
}
console.log(failures === 0 ? '抽样全部通过 ✓' : `共 ${failures} 个问题 ✗`);

// 专项：初始局面 + 炮二平五后黑先
function printNode(title: string, key: string) {
  const node = tree.nodes[key];
  if (!node) {
    console.log(`\n${title}：节点不存在`);
    failures++;
    return;
  }
  const { board, side } = parseFen(`${key} - - 0 1`);
  console.log(`\n${title}（${node.total} 局）`);
  console.log('  走法    收缩胜率  裸胜率  对局数  选择率');
  for (const m of node.moves) {
    const zh = uciToChinese(m.uci, board, side);
    const pick = Math.round((m.count / node.total) * 100);
    console.log(
      `  ${zh}(${m.uci})  ${String(m.winrate).padStart(3)}%  ${String(m.raw).padStart(3)}%  ${String(m.count).padStart(6)}  ${String(pick).padStart(3)}%`,
    );
  }
}
printNode('初始局面（红先）', START_KEY);
printNode('炮二平五后（黑先）', keyAfter('h2e2') + ' b');

process.exit(failures === 0 ? 0 : 1);
