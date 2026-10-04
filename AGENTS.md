# 象棋扫雷（Chess Guess）— AGENTS.md

> 面向 AI 编码代理的项目说明。项目文档与代码注释均使用中文。

## 项目概览

中国象棋（Xiangqi）局面直觉训练工具。核心循环：系统给出真实对局局面 → 玩家标记最多 3 个自认为胜率最高的走法 → 系统揭示所有候选走法的胜率并按规则计分 → 下一题循环。

题库是**多答案、概率化**的：不是手工摆的局面，而是从 14 万+ 真实棋谱（WXF 41,743 局 + 东萍 99,813 局，源自 [CGLemon/chinese-chess-PGN](https://github.com/CGLemon/chinese-chess-PGN)）统计出的开局树（贝叶斯收缩 k=50）。产品定位与路线图见 `ROADMAP.md`。

技术栈：TypeScript（strict）、React 19 + Vite 8（网页版）、原生微信小程序、Node.js 离线数据管线。包管理用 npm。无单元测试框架，回归靠 `node:assert` 断言脚本（见下文"校验与回归"）。

## 工程原则

1. **不保留向后兼容**。过时的直接删，别加兼容层、别写 migration、别留 fallback。
2. **选能满足当前需求的最简单实现**。不要预防性抽象，不要多此一举的配置层。
3. **系统分层生长**。先跑通一个最小的端到端版本，再往上加东西。绝不为了未完成的复杂度拆掉能跑的东西。
4. **组件保持模块化**，关注点分离；合理划分模块，高内聚、低耦合。
5. **优先用成熟的、有人维护的库**。没有明确理由别自己重写。
6. **先翻项目里已有的依赖能做什么**，再考虑加新包或自己写。别上来就假设库里没有。
7. **架构决策往长了做**。不接受"先这样以后再换"的临时方案。
8. **先看成熟产品怎么解决同一个问题**，用已验证的模式，别从零发明。

排查 bug 要深挖根因、纵览全局，防止后续出现相同 bug。

### 质量准则

- 既有测试无需保障通过率，没通过的单元测试可以直接删除
- 文档与代码同步：设计文档随代码更新；历史达成情况保留，被废止的决策用删除线或新决策覆盖
- 诚实优先：review 给证据说话；发现用户指令有问题时摆数据提出，由用户定夺

### 沟通

- 汇报带实质：改动清单、测试数、质量门结果、与计划的偏差及原因
- 未完成/未验证的不说成完成；过程事故（subagent 超时、替换误伤等）如实记录

## 项目结构与模块划分

- `core/` — **领域纯逻辑唯一源，与平台无关**。网页端和小程序端都从这里取逻辑，改棋规/记谱/计分只改这里：
  - `types.ts` — 共享类型（Square/Board/Puzzle/CandidateMove 等）
  - `fen.ts` — FEN 解析、UCI 坐标换算
  - `rules.ts` — 完整走法规则校验（别马腿/塞象眼/炮架/九宫/兵卒/送将/将帅照面）
  - `notation.ts` — 中文记谱（红黑列号方向、进退平、同列双子前后缀）
  - `scoring.ts` — 计分（得分 = 走法胜率本身；不在题库候选中的走法按胜率 30 计）
  - `tree-core.ts` — 开局树纯逻辑（类型、稳定 id、动态出题），两端共用
  - `tsconfig.mp.json` — 把 core 编译成 CJS 输出到 `miniprogram/logic/`
- `web/` — React + Vite 网页版。Vite root 即此目录，构建输出到 `dist/`。逻辑全部来自 `core/`；`web/src/tree.ts` 是开局树装载层（fetch 懒加载 `/opening-tree.json`）；`web/src/generated/opening-puzzles.json` 是静态保底题库（开局树加载失败时回退，与开局树同源生成）
- `miniprogram/` — 原生微信小程序（纯本地无后端，Canvas 2D 棋盘）。`miniprogram/logic/`（除 `tree.ts`、`pieces.ts` 外）和 `miniprogram/data/opening-tree.js` 都是**构建产物，不入库**，由 `npm run build:miniprogram` 重新生成。交互与计分逻辑移植自 `web/src/App.tsx`
- `pipeline/` — 离线数据管线（棋谱 → 开局树），详见 `pipeline/README.md`：
  - `src/` — `download.ts`（占位未实现）、`convert.ts`（ICCS → JSONL）、`validate.ts`（逐局合法性重放）、`build-tree.ts`（构建开局树）、`emit.ts`（分发树数据为小程序 .js 模块）
  - `checks/` — 回归断言脚本（见下文）
  - `data/` — 原始棋谱与中间数据，**不入库**

## 构建与运行命令

```bash
npm install

# 网页版
npm run dev                  # Vite 开发服务器
npm run build                # tsc -b && vite build → dist/
npm run preview
npm run lint                 # oxlint

# 微信小程序（构建后用微信开发者工具打开 miniprogram/）
npm run build:miniprogram    # 三步：tsc 编译 core → miniprogram/logic/，emit 生成
                             # miniprogram/data/opening-tree.js，再 tsc 就地编译 miniprogram
npm run compile:miniprogram  # 仅最后一步 tsc

# 数据管线（pipeline/data/ 不入库，需手动准备原始棋谱）
npm run pipeline:convert -- <输入> <输出.jsonl>
npm run pipeline:validate -- <输入.jsonl>
npm run pipeline:tree        # → web/public/opening-tree.json
```

## 校验与回归（代替单元测试）

项目没有 jest/vitest 之类的测试框架，回归是 `pipeline/checks/` 下的断言脚本（`node:assert`）：

```bash
npm run check:notation       # 中文记谱断言
npm run check:rules          # 走法规则断言
npm run check:tree           # 开局树抽样校验
npm run verify:miniprogram   # 小程序编译产物全量回归（临时目录编译 + 跑断言，
                             # 用例与 check:notation / check:rules 同源）
```

改动 `core/` 后至少跑：`npm run lint`、`npm run build`、`npm run check:notation`、`npm run check:rules`、`npm run verify:miniprogram`。改动 pipeline 后跑 `npm run check:tree`。

## 代码约定与领域知识

- **单一数据源**：棋规/记谱/计分/FEN/出题逻辑只在 `core/`。不要在 `web/` 或 `miniprogram/` 里复制逻辑；小程序页面代码（`pages/index/index.ts`）除外，它是交互层的移植
- **坐标系**（`core/types.ts` / `core/fen.ts` 头部注释）：棋盘 9 列 × 10 行，`board[row][col]`，row 0 在棋盘上方（黑方底线一侧），row 9 在下方（红方底线）
- **UCI 坐标按 Pikafish/ElephantFish 标准**：rank 0 = 红方底线（board row 9），如开局右炮平中为 `h2e2`。接入引擎数据时依赖此约定
- **FEN**：中国象棋标准 FEN，大写字母红方、小写黑方（K/k 帅将、A/a 仕士、B/b 相象、R/r 车、N/n 马、C/c 炮、P/p 兵卒），含行棋方（w/b）
- **中文记谱**（`core/notation.ts`）：红方用中文数字 一~九、从红方视角右往左数（col 8 = 一）；黑方用阿拉伯数字 1~9、从黑方视角右往左数（col 0 = 1）
- **胜率**：0–100，行棋方视角；树数据为贝叶斯收缩后胜率（`winrate = (score + k×0.5)/(count + k)`，k=50），`raw` 字段是裸胜率
- **计分**：得分 = 走法胜率本身（不按固定均势线折算）；不在题库候选中的走法按胜率 30 计（`NOT_IN_BOOK_WINRATE`）
- **生成产物不入库**（见 `.gitignore`）：`miniprogram/**/*.js`、`miniprogram/logic/*.d.ts`、`miniprogram/data/`、`dist/`、`pipeline/data/`。唯一入库的数据成品是 `web/public/opening-tree.json`
- **小程序数据限制**：小程序运行时 `require` 只认 `.js` 模块（`require('.json')` 会报错），所以树数据经 `pipeline/src/emit.ts` 包成 CJS `.js` 壳打进主包（约 1.4MB，主包限额 2MB；扩数据需改分包或云端加载）
- TS 严格模式；app 配置启用了 `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`；lint 用 oxlint（react + typescript 插件）

## 安全与合规注意事项

- 无后端、无密钥、无网络请求（网页版仅 fetch 静态 `opening-tree.json`）；小程序进度存本地 storage
- **引擎合规风险**（`ROADMAP.md` 已标注）：计划接入皮卡鱼（Pikafish）等引擎时，注意其协议的再分发边界——服务端调用与把引擎/权重打进客户端分发的合规要求不同
- 棋谱数据源自第三方开源仓库，致谢与来源声明保留在 `README.md` 末尾，不要移除
- `pipeline:download` 是占位脚本（手动放棋谱），其中"断点续传、再分发合规边界"待讨论，补实现前先读其头部注释
