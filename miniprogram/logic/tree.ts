// 小程序开局树装载层：数据经 emit 生成的 CJS 模块打进主包（约 1.4MB，主包限额 2MB，
// 扩数据需改分包或云端加载）；出题纯函数与类型来自 core/tree-core.ts 的编译产物。
// 对应网页装载层：web/src/tree.ts（fetch 懒加载）。
import type { OpeningTree } from './tree-core';

export { fenId, randomPuzzleFromTree } from './tree-core';
export type { OpeningTree, TreeMove, TreeNode } from './tree-core';

// 小程序运行时 require 只认 .js 模块，故数据为 pipeline/src/emit.ts 生成的 .js 壳
export const tree = require('../data/opening-tree.js') as OpeningTree;
