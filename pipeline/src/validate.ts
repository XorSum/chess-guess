// 棋谱重放验证：npx tsx pipeline/src/validate.ts <输入.jsonl>
// 从 fen 开始重放 moves，用 src/rules.ts 的 isLegalMove 校验每一步。
// 非法局写入 <输入去掉.jsonl>.invalid.jsonl，并打印统计。
import { createReadStream, createWriteStream } from 'node:fs';
import readline from 'node:readline';
import { parseFen, uciToSquares, pieceSide } from '../../core/fen';
import { isLegalMove } from '../../core/rules';
import type { Board, Side, Square } from '../../core/types';

function applyMove(board: Board, from: Square, to: Square): void {
  board[to.row][to.col] = board[from.row][from.col];
  board[from.row][from.col] = null;
}

async function main() {
  const [input] = process.argv.slice(2);
  if (!input) {
    console.error('用法：npx tsx pipeline/src/validate.ts <输入.jsonl>');
    process.exit(1);
  }
  const invalidPath = input.replace(/\.jsonl$/, '') + '.invalid.jsonl';
  const invalidOut = createWriteStream(invalidPath);

  let total = 0;
  let legal = 0;
  let illegal = 0;
  let parseErrors = 0;
  let totalMoves = 0;
  const failReasons = new Map<string, number>();
  const bump = (r: string) => failReasons.set(r, (failReasons.get(r) ?? 0) + 1);

  const rl = readline.createInterface({ input: createReadStream(input), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    let game: { fen: string; moves: string[] };
    try {
      game = JSON.parse(line);
    } catch {
      parseErrors++;
      illegal++;
      bump('JSON 解析失败');
      invalidOut.write(line + '\n');
      continue;
    }
    let board: Board;
    let side: Side;
    try {
      ({ board, side } = parseFen(game.fen));
    } catch (e) {
      parseErrors++;
      illegal++;
      bump(`FEN 解析失败：${(e as Error).message.slice(0, 40)}`);
      invalidOut.write(line + '\n');
      continue;
    }
    totalMoves += game.moves.length;
    let failReason: string | null = null;
    for (let i = 0; i < game.moves.length; i++) {
      const uci = game.moves[i];
      let from: Square, to: Square;
      try {
        ({ from, to } = uciToSquares(uci));
      } catch {
        failReason = `第 ${i + 1} 手 ${uci}：UCI 格式非法`;
        break;
      }
      const piece = board[from.row][from.col];
      if (!piece) {
        failReason = `第 ${i + 1} 手 ${uci}：起点无子`;
        break;
      }
      if (pieceSide(piece) !== side) {
        failReason = `第 ${i + 1} 手 ${uci}：走了对方（${pieceSide(piece)}）的子`;
        break;
      }
      if (!isLegalMove(board, from, to)) {
        failReason = `第 ${i + 1} 手 ${uci}：不符合走法规则或送将`;
        break;
      }
      applyMove(board, from, to);
      side = side === 'red' ? 'black' : 'red';
    }
    if (failReason) {
      illegal++;
      bump(failReason.replace(/：.*/, ''));
      invalidOut.write(line + '\n');
    } else {
      legal++;
    }
  }
  await new Promise<void>((resolve) => invalidOut.end(resolve));

  console.log(`输入：${input}`);
  console.log(`总局数：${total}`);
  console.log(`合法局数：${legal}`);
  console.log(`非法局数：${illegal}（已写入 ${invalidPath}）`);
  console.log(`平均每局步数：${total > 0 ? (totalMoves / total).toFixed(1) : 0}`);
  if (failReasons.size > 0) {
    console.log('非法原因分布：');
    for (const [reason, count] of [...failReasons.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}\t${reason}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
