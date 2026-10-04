// 开局树：网页端装载层。成品数据 web/public/opening-tree.json 由 pipeline 构建，
// 纯逻辑（类型、出题、id）在 core/tree-core.ts，两端共享。
import type { OpeningTree } from '../../core/tree-core';

export { fenId, randomPuzzleFromTree } from '../../core/tree-core';
export type { OpeningTree, TreeMove, TreeNode } from '../../core/tree-core';

let cached: Promise<OpeningTree> | null = null;

export function loadTree(): Promise<OpeningTree> {
  cached ??= fetch('/opening-tree.json').then((res) => {
    if (!res.ok) throw new Error(`开局树加载失败：HTTP ${res.status}`);
    return res.json() as Promise<OpeningTree>;
  });
  return cached;
}
