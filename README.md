# 象棋扫雷（Chess Guess）

中国象棋局面直觉训练工具。

系统给出真实对局局面，玩家标出最多 3 个自认为胜率最高的走法，系统揭示所有候选走法的胜率并计分，循环训练。
本题库是**多答案、概率化**的——练局面直觉，而非计算力。

## 运行

```bash
npm install

# 网页版
npm run dev

# 微信小程序：先构建，再用微信开发者工具打开 miniprogram/
npm run build:miniprogram
```

## 题库

题库不是手工摆的局面，而是从 14 万+ 真实对局统计出的开局树（贝叶斯收缩 k=50），单一数据成品为 `web/public/opening-tree.json`（入库）。棋谱来源见文末致谢，管线细节见 [pipeline/README.md](./pipeline/README.md)。

## 项目结构

- `core/` — 领域纯逻辑唯一源（棋规/记谱/计分/FEN/树出题），与平台无关
- `web/` — React + Vite 网页版，逻辑全部来自 `core/`
- `miniprogram/` — 原生微信小程序，逻辑与数据为构建产物
- `pipeline/` — 离线数据管线（棋谱 → 开局树），见 [pipeline/README.md](./pipeline/README.md)

## 路线图

见 [ROADMAP.md](./ROADMAP.md)。

## 致谢（Acknowledgements）

- **[CGLemon/chinese-chess-PGN](https://github.com/CGLemon/chinese-chess-PGN)** —— 感谢作者收集整理并向 AI 研究社区开放棋谱数据。本项目题库源自其中的两个集合：
  - 世界象棋联合会（WXF）对局 41,743 局
  - 东萍象棋棋谱仓库对局 99,813 局
