# 象棋扫雷（Chess Guess）

中国象棋局面直觉训练工具。系统给出局面，玩家标出最多 3 个自认为胜率最高的走法，系统揭示所有候选走法的胜率并计分，循环训练。

## 项目结构

```
chess-guess/
├─ core/          # 领域纯逻辑唯一源（与平台无关）：棋规 / 记谱 / 计分 / FEN / 树出题
├─ pipeline/      # 离线数据管线：download(占位) / convert / validate / build-tree / emit
│  ├─ src/        # 管线步骤脚本
│  ├─ checks/     # 回归校验脚本
│  └─ data/       # 原始棋谱与中间数据（不入库）
├─ web/           # React + Vite 网页版（UI + 编排，逻辑全部来自 core/）
├─ miniprogram/   # 原生微信小程序（logic/ 与 data/ 为 build 产物，不入库）
└─ vite.config.ts # vite root 指向 web/
```

数据只有一份成品：`web/public/opening-tree.json`（入库，由 pipeline 构建）。
小程序主包里的 `data/opening-tree.js` 与 `logic/*.js` 均为 `npm run build:miniprogram`
自动生成的构建产物——小程序运行时 require 只认 .js 模块，故需要这层 .js 壳。

## 运行

```bash
npm install

# 网页版
npm run dev

# 微信小程序：先构建（core 编译 + 数据分发 + mp 编译），再用微信开发者工具打开 miniprogram/
npm run build:miniprogram
```

## 数据管线

题库来自真实对局统计（开局树），全部步骤在 `pipeline/` 下：

```bash
# 0. 下载源谱（占位未实现，目前手动放入 pipeline/data/raw/）
npm run pipeline:download

# 1. ICCS 棋谱 → 标准 JSONL（pipeline/data/raw/ → pipeline/data/games/）
npm run pipeline:convert -- <输入> <输出.jsonl>

# 2. 逐局合法性重放校验
npm run pipeline:validate -- <输入.jsonl>

# 3. 构建开局树（贝叶斯收缩 k=50）→ web/public/opening-tree.json
npm run pipeline:tree

# 4. 校验与回归
npm run check:tree          # 开局树抽样校验
npm run check:notation      # 中文记谱
npm run check:rules         # 走法规则
npm run verify:miniprogram  # 小程序编译产物全量回归
```

`pipeline/data/` 不入库；`web/public/opening-tree.json` 是唯一入库的数据成品。

## 致谢（Acknowledgements）

- **[CGLemon/chinese-chess-PGN](https://github.com/CGLemon/chinese-chess-PGN)** —— 感谢作者收集整理并向 AI 研究社区开放棋谱数据。本项目题库源自其中的两个集合：
  - 世界象棋联合会（WXF）对局 41,743 局
  - 东萍象棋棋谱仓库对局 99,813 局

## 路线图

见 [ROADMAP.md](./ROADMAP.md)。
