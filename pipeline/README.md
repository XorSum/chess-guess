# 数据管线（pipeline/）

把真实对局棋谱加工成开局树题库。产出只有一份成品：`web/public/opening-tree.json`（入库）；`pipeline/data/` 为原始棋谱与中间数据，不入库。

## 步骤

```bash
# 0. 下载源谱（占位未实现，目前手动放入 pipeline/data/raw/）
npm run pipeline:download

# 1. ICCS 棋谱 → 标准 JSONL（pipeline/data/raw/ → pipeline/data/games/）
npm run pipeline:convert -- <输入> <输出.jsonl>

# 2. 逐局合法性重放校验
npm run pipeline:validate -- <输入.jsonl>

# 3. 构建开局树（贝叶斯收缩 k=50）→ web/public/opening-tree.json
npm run pipeline:tree
```

## 校验与回归

```bash
npm run check:tree          # 开局树抽样校验
npm run check:notation      # 中文记谱
npm run check:rules         # 走法规则
npm run verify:miniprogram  # 小程序编译产物全量回归
```

## 小程序分发

`npm run build:miniprogram` 会把开局树分发为小程序主包内可 require 的 .js 模块（`miniprogram/data/opening-tree.js`，构建产物不入库）。为什么要这层 .js 壳、以及具体实现，见 `pipeline/src/emit.ts` 头部注释。
