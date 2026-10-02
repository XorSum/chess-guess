// 开局树：public/opening-tree.json 的加载与动态出题
// 树由 scripts/build-opening-tree.ts 基于 14 万局棋谱统计生成（贝叶斯收缩胜率）。
import type { Puzzle } from './types';

export interface TreeMove {
  uci: string;
  winrate: number; // 收缩后胜率（计分用）
  count: number; // 对局数
  raw: number; // 裸胜率
}

export interface TreeNode {
  total: number; // 局面总局数（含未入选走法）
  moves: TreeMove[];
}

export interface OpeningTree {
  version: number;
  priorK: number;
  minCandidateMoves: number; // 题目合格条件：节点内走法数 ≥ 此值
  nodes: Record<string, TreeNode>; // key = FEN 棋局部分 + 行棋方，如 "...RNBAKABNR w"
}

let cached: Promise<OpeningTree> | null = null;

export function loadTree(): Promise<OpeningTree> {
  cached ??= fetch('/opening-tree.json').then((res) => {
    if (!res.ok) throw new Error(`开局树加载失败：HTTP ${res.status}`);
    return res.json() as Promise<OpeningTree>;
  });
  return cached;
}

// djb2 哈希，给树题目一个稳定 id
function fenId(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `tree-${h.toString(36)}`;
}

// Puzzle.fen 带 " - - 0 1" 后缀，树键不带
function toKey(fen: string): string {
  return fen.replace(/ - - 0 1$/, '');
}

// 从合格节点中均匀随机取一题；exceptFen 用于避免连续两题重复
export function randomPuzzleFromTree(tree: OpeningTree, exceptFen?: string): Puzzle {
  const minMoves = tree.minCandidateMoves ?? 4;
  const exceptKey = exceptFen ? toKey(exceptFen) : null;
  const eligible = Object.keys(tree.nodes).filter(
    (k) => tree.nodes[k].moves.length >= minMoves && k !== exceptKey,
  );
  const key = eligible[Math.floor(Math.random() * eligible.length)];
  const node = tree.nodes[key];
  return {
    id: fenId(key),
    fen: `${key} - - 0 1`,
    hint: `开局 · ${key.endsWith(' w') ? '红先' : '黑先'}`,
    moves: node.moves,
    positionTotal: node.total,
  };
}
