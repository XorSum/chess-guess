// 走法规则校验：npx tsx pipeline/checks/check-rules.ts
import { parseFen, uciToSquares } from '../../core/fen';
import { isLegalMove } from '../../core/rules';
import { PUZZLES } from '../../web/src/puzzles';

const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR';

let failures = 0;
function check(uci: string, fen: string, side: 'red' | 'black', expected: boolean, note: string) {
  const { board } = parseFen(`${fen} ${side === 'red' ? 'w' : 'b'} - - 0 1`);
  const { from, to } = uciToSquares(uci);
  const actual = isLegalMove(board, from, to);
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${note}：${uci} 应${expected ? '合法' : '不合法'}，实际${actual ? '合法' : '不合法'}`);
}

console.log('== 马 ==');
check('b0c2', START, 'red', true, '初始局面 马八进七');
check('b0a2', START, 'red', true, '初始局面 马八进九');
check('b0d1', START, 'red', false, '马不走直线');
// 别马腿：红马 e5，黑卒 e4 挡住向上的马腿
const HORSE_LEG = '3k5/9/9/9/4p4/4N4/9/9/9/4K4';
check('e4f6', HORSE_LEG, 'red', false, '别马腿（马腿有子，日字步不可走）');
check('e4d2', HORSE_LEG, 'red', true, '另一方向马腿畅通');

console.log('== 炮 ==');
const CANNON_ONE = '3k5/9/9/9/9/4c4/4P4/4C4/9/4K4'; // 红炮 e2、红兵 e3、黑炮 e4
check('e2e4', CANNON_ONE, 'red', true, '隔一子吃子（炮架）');
check('e2e5', CANNON_ONE, 'red', false, '不吃子但路径有子');
const CANNON_ZERO = '3k5/9/9/9/9/4c4/9/4C4/9/4K4'; // 红炮 e2、黑炮 e5，中间无子
check('e2e4', CANNON_ZERO, 'red', false, '无炮架吃子');
const CANNON_TWO = '3k5/9/4n4/9/9/4c4/4P4/4C4/9/4K4'; // 炮架 + 黑马 e7，目标黑炮 e5 之间隔两子？（兵 e3、马 e7 在目标之后）
check('e2e7', CANNON_TWO, 'red', false, '隔两子吃子');

console.log('== 相/象 ==');
const ELEPHANT_EYE = '3k5/9/9/9/9/9/9/9/5P3/4K1B2'; // 红相 g9，红兵 f8 塞住 e7 象眼
check('g0e2', ELEPHANT_EYE, 'red', false, '塞象眼');
const ELEPHANT_OK = '3k5/9/9/9/9/9/9/9/9/4K1B2';
check('g0e2', ELEPHANT_OK, 'red', true, '象眼畅通');
const ELEPHANT_RIVER = '3k5/9/9/9/9/2B6/9/9/9/4K4'; // 红相 c5（河边）
check('c4e6', ELEPHANT_RIVER, 'red', false, '相不可过河');
check('c4a2', ELEPHANT_RIVER, 'red', true, '相回本方半场');

console.log('== 仕/士 ==');
const ADVISOR = '3k5/9/9/9/9/9/9/9/9/3AK4';
check('d0e1', ADVISOR, 'red', true, '仕斜走一格（九宫内）');
check('d0d1', ADVISOR, 'red', false, '仕直走');
check('d0c1', ADVISOR, 'red', false, '仕出九宫');

console.log('== 兵/卒 ==');
const PAWN_HOME = '3k5/9/9/9/9/9/4P4/9/9/4K4'; // 红兵 e6 未过河
check('e3e4', PAWN_HOME, 'red', true, '未过河向前');
check('e3f3', PAWN_HOME, 'red', false, '未过河横向');
check('e3e2', PAWN_HOME, 'red', false, '兵不可后退');
const PAWN_RIVER = '3k5/9/9/9/4P4/9/9/9/9/4K4'; // 红兵 e5 已过河
check('e5f5', PAWN_RIVER, 'red', true, '过河后横向');
check('e5e4', PAWN_RIVER, 'red', false, '过河后仍不可后退');

console.log('== 送将 / 将帅照面 ==');
const PIN_ROOK = '4r4/9/9/9/9/9/9/9/4R4/4K4'; // 黑车 e0 盯红帅，红车 e8 是唯一屏障
check('e1d1', PIN_ROOK, 'red', false, '送将：闪开屏障后被黑车将');
check('e1e4', PIN_ROOK, 'red', true, '车沿 e 线退仍挡将');
const FACING = '4k4/9/9/9/9/9/9/9/4R4/4K4'; // 红车 e8 是将帅之间唯一的子
check('e1d1', FACING, 'red', false, '将帅照面：闪开后两帅相对');
check('e1e4', FACING, 'red', true, '车仍在将帅之间');

console.log('\n== 题库 12 题候选走法全规则复核 ==');
for (const p of PUZZLES) {
  const { board, side } = parseFen(p.fen);
  const illegal: string[] = [];
  for (const m of p.moves) {
    const { from, to } = uciToSquares(m.uci);
    if (!isLegalMove(board, from, to)) illegal.push(m.uci);
  }
  if (illegal.length > 0) failures += illegal.length;
  console.log(`  ${illegal.length === 0 ? '✓' : '✗'} [${p.id}] ${p.moves.length} 个候选走法${illegal.length === 0 ? '全部合法' : `，非法：${illegal.join(', ')}`}`);
}

console.log(`\n${failures === 0 ? '全部通过 ✓' : `共 ${failures} 个失败 ✗`}`);
process.exit(failures === 0 ? 0 : 1);
