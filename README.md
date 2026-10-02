# 象棋扫雷（Chess Guess）

中国象棋局面直觉训练工具。系统给出局面，玩家标出最多 3 个自认为胜率最高的走法，系统揭示所有候选走法的胜率并计分，循环训练。

## 运行

```bash
npm install
npm run dev
```

## 数据管线

题库来自真实对局统计（开局树），重建流程：

```bash
# 1. ICCS 棋谱 → 标准 JSONL（data/raw/ → data/games/）
npx tsx scripts/convert-iccs.ts <输入> <输出.jsonl>

# 2. 逐局合法性重放校验
npx tsx scripts/validate-games.ts <输入.jsonl>

# 3. 构建开局树（贝叶斯收缩 k=50）→ public/opening-tree.json
npx tsx scripts/build-opening-tree.ts

# 4. 校验
npx tsx scripts/check-opening-tree.ts
```

`data/` 与 `engines/` 不入库；`public/opening-tree.json` 是前端直接消费的成品。

## 致谢（Acknowledgements）

- **[CGLemon/chinese-chess-PGN](https://github.com/CGLemon/chinese-chess-PGN)** —— 感谢作者收集整理并向 AI 研究社区开放棋谱数据。本项目题库源自其中的两个集合：
  - 世界象棋联合会（WXF）对局 41,743 局
  - 东萍象棋棋谱仓库对局 99,813 局

## 路线图

见 [ROADMAP.md](./ROADMAP.md)。
