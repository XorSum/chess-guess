// 小程序逻辑回归验证：core 编译（CJS）+ emit 数据 + mp 编译到临时目录后跑断言
// （记谱/规则/计分/开局树）。运行：npm run verify:miniprogram
// 断言用例与 pipeline/checks/check-notation.ts、pipeline/checks/check-rules.ts 保持同源。
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import type { OpeningTree } from '../../core/tree-core';

const root = resolve(dirnameOf(import.meta.url), '../..');
const mp = resolve(root, 'miniprogram');
const tmp = resolve(root, 'node_modules/.cache/mp-verify');
const tsc = resolve(root, 'node_modules/.bin/tsc');

function dirnameOf(url: string): string {
  return fileURLToPath(new URL('.', url));
}

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// 1. core → miniprogram/logic（真实位置：mp tsc 需要这些 .d.ts 做 import 类型解析；同 build:miniprogram 第一步）
console.log('== tsc 编译 core（CJS + 声明）==');
execSync(`"${tsc}" -p "${resolve(root, 'core/tsconfig.mp.json')}"`, { stdio: 'inherit' });

// 2. core → tmp/logic（运行时 require 用，CLI 覆盖 outDir）
execSync(`"${tsc}" -p "${resolve(root, 'core/tsconfig.mp.json')}" --outDir "${tmp}/logic"`, {
  stdio: 'inherit',
});

// 3. emit 数据（真实位置）后拷入 tmp：tmp/logic/tree.js 里 require('../data/opening-tree.js')
console.log('== emit 树数据 ==');
execSync(`node "${resolve(root, 'pipeline/src/emit.ts')}"`, { stdio: 'inherit' });
mkdirSync(resolve(tmp, 'data'), { recursive: true });
cpSync(resolve(mp, 'data/opening-tree.js'), resolve(tmp, 'data/opening-tree.js'));

// 4. mp 源码编译到 tmp（strict）
console.log('== tsc 编译 miniprogram（strict）==');
execSync(`"${tsc}" -p "${mp}/tsconfig.json" --outDir "${tmp}" --rootDir "${mp}"`, {
  stdio: 'inherit',
});

const req = createRequire(import.meta.url);
const fen = req(resolve(tmp, 'logic/fen.js')) as typeof import('../../core/fen');
const rules = req(resolve(tmp, 'logic/rules.js')) as typeof import('../../core/rules');
const notation = req(resolve(tmp, 'logic/notation.js')) as typeof import('../../core/notation');
const scoring = req(resolve(tmp, 'logic/scoring.js')) as typeof import('../../core/scoring');
const treeMod = req(resolve(tmp, 'logic/tree.js')) as typeof import('../../core/tree-core') & {
  tree: OpeningTree;
};

const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR';

// ---------- FEN / UCI ----------
console.log('== FEN / UCI ==');
{
  const { board, side } = fen.parseFen(`${START} w - - 0 1`);
  assert.strictEqual(side, 'red');
  assert.strictEqual(board.flat().filter(Boolean).length, 32);
  const { from, to } = fen.uciToSquares('h2e2');
  assert.deepStrictEqual(from, { row: 7, col: 7 });
  assert.deepStrictEqual(to, { row: 7, col: 4 });
  assert.strictEqual(fen.squaresToUci(from, to), 'h2e2');
  console.log('  ✓ 初始局面解析 32 子；h2e2 ↔ {row:7,col:7}→{row:7,col:4}');
}

// ---------- 中文记谱（与 check-notation.ts 同源用例） ----------
console.log('== 中文记谱 ==');
{
  const cases: Array<[string, string, 'red' | 'black', string]> = [
    ['h2e2', START, 'red', '炮二平五'],
    ['b0c2', START, 'red', '马八进七'],
    ['h7e7', START, 'black', '炮8平5'],
    ['h9g7', START, 'black', '马8进7'],
    ['b9c7', START, 'black', '马2进3'],
  ];
  for (const [uci, f, side, expected] of cases) {
    const { board } = fen.parseFen(`${f} ${side === 'red' ? 'w' : 'b'} - - 0 1`);
    assert.strictEqual(notation.uciToChinese(uci, board, side), expected);
  }
  console.log('  ✓ 炮二平五 / 马八进七 / 炮8平5 等基础用例');

  const TWO_ROOKS = '4k4/9/9/9/9/R8/R8/9/9/4K4';
  const rooks = fen.parseFen(`${TWO_ROOKS} w - - 0 1`);
  assert.strictEqual(notation.uciToChinese('a4a6', rooks.board, 'red'), '前车进二');
  assert.strictEqual(notation.uciToChinese('a3b3', rooks.board, 'red'), '后车平八');
  console.log('  ✓ 同列双子前后缀（前车进二 / 后车平八）');
}

// ---------- 走法规则（与 check-rules.ts 同源用例） ----------
console.log('== 走法规则 ==');
{
  const check = (uci: string, f: string, side: 'red' | 'black', expected: boolean) => {
    const { board } = fen.parseFen(`${f} ${side === 'red' ? 'w' : 'b'} - - 0 1`);
    const { from, to } = fen.uciToSquares(uci);
    assert.strictEqual(rules.isLegalMove(board, from, to), expected, `${uci} 于 ${f}`);
  };
  check('b0c2', START, 'red', true); // 马八进七
  const HORSE_LEG = '3k5/9/9/9/4p4/4N4/9/9/9/4K4';
  check('e4f6', HORSE_LEG, 'red', false); // 别马腿
  check('e4d2', HORSE_LEG, 'red', true);
  const CANNON_ONE = '3k5/9/9/9/9/4c4/4P4/4C4/9/4K4';
  check('e2e4', CANNON_ONE, 'red', true); // 隔一子吃子（炮架）
  check('e2e5', CANNON_ONE, 'red', false); // 不吃子但路径有子
  const CANNON_ZERO = '3k5/9/9/9/9/4c4/9/4C4/9/4K4';
  check('e2e4', CANNON_ZERO, 'red', false); // 无炮架吃子
  const ELEPHANT_EYE = '3k5/9/9/9/9/9/9/9/5P3/4K1B2';
  check('g0e2', ELEPHANT_EYE, 'red', false); // 塞象眼
  const ELEPHANT_RIVER = '3k5/9/9/9/9/2B6/9/9/9/4K4';
  check('c4e6', ELEPHANT_RIVER, 'red', false); // 相不可过河
  check('c4a2', ELEPHANT_RIVER, 'red', true);
  const ADVISOR = '3k5/9/9/9/9/9/9/9/9/3AK4';
  check('d0e1', ADVISOR, 'red', true); // 仕斜走
  check('d0d1', ADVISOR, 'red', false);
  const PAWN_HOME = '3k5/9/9/9/9/9/4P4/9/9/4K4';
  check('e3f3', PAWN_HOME, 'red', false); // 未过河横向
  check('e3e2', PAWN_HOME, 'red', false); // 兵不可后退
  const PAWN_RIVER = '3k5/9/9/9/4P4/9/9/9/9/4K4';
  check('e5f5', PAWN_RIVER, 'red', true); // 过河后横向
  const PIN_ROOK = '4r4/9/9/9/9/9/9/9/4R4/4K4';
  check('e1d1', PIN_ROOK, 'red', false); // 送将
  const FACING = '4k4/9/9/9/9/9/9/9/4R4/4K4';
  check('e1d1', FACING, 'red', false); // 将帅照面
  check('e1e4', FACING, 'red', true);
  console.log('  ✓ 马腿/炮架/象眼/过河/仕途/兵规则/送将/照面 16 例');
}

// ---------- 计分 ----------
console.log('== 计分 ==');
{
  const puzzle = {
    id: 't',
    fen: `${START} w - - 0 1`,
    moves: [
      { uci: 'c3c4', winrate: 60 },
      { uci: 'g3g4', winrate: 57 },
    ],
  };
  const inBook = scoring.scoreMove(puzzle, 'c3c4');
  assert.strictEqual(inBook.inBook, true);
  assert.strictEqual(inBook.points, 60);
  const outBook = scoring.scoreMove(puzzle, 'a0a1');
  assert.strictEqual(outBook.inBook, false);
  assert.strictEqual(outBook.effectiveWinrate, 30);
  assert.strictEqual(outBook.points, 30);
  const round = scoring.scoreRound(puzzle, [
    { uci: 'c3c4', from: { row: 9, col: 2 }, to: { row: 6, col: 2 } },
    { uci: 'a0a1', from: { row: 9, col: 0 }, to: { row: 8, col: 0 } },
  ]);
  assert.strictEqual(round.total, 90);
  console.log('  ✓ 在库得分=胜率；不在库固定 30；两标记合计 90');
}

// ---------- 开局树 ----------
console.log('== 开局树 ==');
{
  const tree = treeMod.tree;
  const nodeCount = Object.keys(tree.nodes).length;
  assert.ok(nodeCount > 7000, `树节点数异常：${nodeCount}`);
  const initial = tree.nodes['rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w'];
  assert.ok(initial && initial.moves.length >= 4);
  assert.ok(initial.moves[0].winrate > 0);
  console.log(`  ✓ 树加载成功：${nodeCount} 节点，初始局面 ${initial.moves.length} 个候选`);

  // 抽样 20 题：出题合格 + 局面可解析 + 候选走法全部合法
  const minMoves = tree.minCandidateMoves ?? 4;
  for (let i = 0; i < 20; i++) {
    const p = treeMod.randomPuzzleFromTree(tree);
    assert.ok(p.moves.length >= minMoves, `题目候选不足：${p.fen}`);
    assert.ok(p.id.startsWith('tree-'));
    const { board, side } = fen.parseFen(p.fen);
    for (const m of p.moves) {
      const { from, to } = fen.uciToSquares(m.uci);
      assert.ok(rules.isLegalMove(board, from, to), `非法候选 ${m.uci} 于 ${p.fen}`);
      // 记谱不崩且非原样返回（即能识别棋子）
      const cn = notation.uciToChinese(m.uci, board, side);
      assert.ok(cn !== m.uci, `记谱失败 ${m.uci}`);
    }
  }
  console.log('  ✓ 随机抽样 20 题全部合格（候选 ≥ 4、走法合法、记谱正常）');
}

console.log('\n全部通过 ✓');
