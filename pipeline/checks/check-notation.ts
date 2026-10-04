// 中文记谱校验：npx tsx pipeline/checks/check-notation.ts
import { parseFen } from '../../core/fen';
import { uciToChinese } from '../../core/notation';
import { PUZZLES } from '../../web/src/puzzles';

const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR';

let failures = 0;
function assert(uci: string, fen: string, side: 'red' | 'black', expected: string) {
  const { board } = parseFen(`${fen} ${side === 'red' ? 'w' : 'b'} - - 0 1`);
  const actual = uciToChinese(uci, board, side);
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} [${side}] ${uci} → ${actual}${ok ? '' : `（期望 ${expected}）`}`);
}

console.log('== 已知样例断言 ==');
assert('h2e2', START, 'red', '炮二平五');
assert('b0c2', START, 'red', '马八进七');
assert('h7e7', START, 'black', '炮8平5');
// 注：黑方"马8进7"对应的 uci 是 h9g7；b9c7 是镜像的另一只马，按规则为 马2进3。
assert('h9g7', START, 'black', '马8进7');
assert('b9c7', START, 'black', '马2进3');

console.log('\n== 前后缀（同列双子）断言 ==');
const TWO_ROOKS = '4k4/9/9/9/9/R8/R8/9/9/4K4';
assert('a4a6', TWO_ROOKS, 'red', '前车进二');
assert('a3b3', TWO_ROOKS, 'red', '后车平八');
const TWO_CANNONS = '4k4/4c4/9/4c4/9/9/9/9/9/4K4';
assert('e6e4', TWO_CANNONS, 'black', '前炮进2');
assert('e8e6', TWO_CANNONS, 'black', '后炮进2');

console.log('\n== 题库抽样对照（前 3 题，每题前 4 个候选） ==');
for (const p of PUZZLES.slice(0, 3)) {
  const { board, side } = parseFen(p.fen);
  console.log(`\n[${p.id}] ${p.hint ?? ''}（${side === 'red' ? '红' : '黑'}先）`);
  for (const m of p.moves.slice(0, 4)) {
    console.log(`  ${m.uci}  ${String(m.winrate).padStart(2)}%  ${uciToChinese(m.uci, board, side)}`);
  }
}

console.log(`\n断言${failures === 0 ? '全部通过 ✓' : `有 ${failures} 个失败 ✗`}`);
process.exit(failures === 0 ? 0 : 1);
