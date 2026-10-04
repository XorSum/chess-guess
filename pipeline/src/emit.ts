// emit：把唯一成品 web/public/opening-tree.json 分发为小程序主包内可 require 的 CJS 模块。
// 注意：小程序运行时 require 只认 .js 模块（require('.json') 会被解析器自动追加 .js 后缀
// 而报错 module not found，微信开放社区有实测案例），所以主包内必须是一份 .js 壳。
// 这份壳是构建产物（不入库），git 里的数据只有 web/public/opening-tree.json 一份。
// 运行：node pipeline/src/emit.ts（build:miniprogram 中的一步）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = resolve(root, 'web/public/opening-tree.json');
const out = resolve(root, 'miniprogram/data/opening-tree.js');

const tree: { nodes: Record<string, unknown> } = JSON.parse(readFileSync(src, 'utf8'));
mkdirSync(dirname(out), { recursive: true });

const banner =
  '// 自动生成，勿手改：node pipeline/src/emit.ts（源自 web/public/opening-tree.json）\n';
writeFileSync(out, `${banner}module.exports = ${JSON.stringify(tree)};\n`, 'utf8');

console.log(`opening-tree: ${Object.keys(tree.nodes).length} 节点 → ${out}`);
