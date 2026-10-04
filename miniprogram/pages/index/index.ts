// 象棋扫雷 · 主页面
// Canvas 2D 棋盘（逻辑坐标 528x584，按屏宽等比缩放 + dpr），交互与计分逻辑移植自网页版 src/App.tsx。
import { parseFen, pieceSide, sameSquare, squaresToUci } from '../../logic/fen';
import { isLegalMove } from '../../logic/rules';
import { uciToChinese } from '../../logic/notation';
import { scoreRound } from '../../logic/scoring';
import { randomPuzzleFromTree, tree as openingTree } from '../../logic/tree';
import type { OpeningTree } from '../../logic/tree';
import { pieceLabel, PIECE_COLORS } from '../../logic/pieces';
import type { Board, GamePhase, MarkedMove, Puzzle, ScoredMark, Side, Square } from '../../logic/types';

const CELL = 56;
const PAD = 40;
const BOARD_W = PAD * 2 + CELL * 8; // 528
const BOARD_H = PAD * 2 + CELL * 9; // 584
const MAX_MARKS = 3;
const STORE_KEY = 'chess-guess-progress';

// 炮位/兵位标记点
const STAR_POINTS: Square[] = [
  { row: 2, col: 1 },
  { row: 2, col: 7 },
  { row: 7, col: 1 },
  { row: 7, col: 7 },
  { row: 3, col: 0 },
  { row: 3, col: 2 },
  { row: 3, col: 4 },
  { row: 3, col: 6 },
  { row: 3, col: 8 },
  { row: 6, col: 0 },
  { row: 6, col: 2 },
  { row: 6, col: 4 },
  { row: 6, col: 6 },
  { row: 6, col: 8 },
];

interface RevealItem {
  uci: string;
  chinese: string;
  winrate: number;
  pickRate: number;
  points: number;
  marked: boolean;
  barClass: string;
}

// hint 形如"开局 · 红先"，只取阶段/先后手分段，不剧透
function stageHint(hint?: string): string {
  return hint?.split('·').slice(0, 2).join('·').trim() ?? '';
}

function barClass(winrate: number): string {
  if (winrate > 65) return 'bar-good';
  if (winrate > 50) return 'bar-ok';
  if (winrate >= 35) return 'bar-mediocre';
  return 'bar-bad';
}

function roundRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

Page({
  // ---------- 响应式数据（WXML 绑定） ----------
  data: {
    boardW: 375,
    boardH: 416,
    round: 1,
    totalScore: 0,
    hint: '',
    statusText: '',
    statusIsScore: false,
    btnLabel: '提交',
    btnDisabled: true,
    showReveal: false,
    revealTitleHint: '',
    revealItems: [] as RevealItem[],
    notInBookItems: [] as RevealItem[],
  },

  // ---------- 非响应式实例状态 ----------
  tree: openingTree as OpeningTree,
  puzzle: null as Puzzle | null,
  board: [] as Board,
  side: 'red' as Side,
  phase: 'marking' as GamePhase,
  marks: [] as MarkedMove[],
  selected: null as Square | null,
  flash: null as Square | null,
  flashTimer: 0,
  lastScored: null as { items: ScoredMark[]; total: number } | null,
  canvas: null as any,
  ctx: null as any,
  dpr: 1,
  viewScale: 1,

  // ---------- 生命周期 ----------
  onLoad() {
    const info = wx.getWindowInfo();
    const boardW = Math.min(info.windowWidth - 24, 520);
    const boardH = Math.round((boardW * BOARD_H) / BOARD_W);
    const saved = (wx.getStorageSync(STORE_KEY) ?? {}) as { totalScore?: number; round?: number };
    this.setData({
      boardW,
      boardH,
      totalScore: saved.totalScore ?? 0,
      round: saved.round ?? 1,
    });
    this.newPuzzle();
  },

  onReady() {
    wx.createSelectorQuery()
      .select('#board')
      .fields({ node: true, size: true })
      .exec((res) => {
        const { node, width, height } = res[0];
        const canvas = node as any;
        const dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = dpr;
        this.viewScale = width / BOARD_W;
        this.renderBoard();
      });
  },

  onUnload() {
    clearTimeout(this.flashTimer);
  },

  // ---------- 出题 ----------
  newPuzzle() {
    const p = randomPuzzleFromTree(this.tree, this.puzzle?.fen);
    const { board, side } = parseFen(p.fen);
    this.puzzle = p;
    this.board = board;
    this.side = side;
    this.phase = 'marking';
    this.marks = [];
    this.selected = null;
    this.flash = null;
    this.lastScored = null;
    this.setData({
      hint: stageHint(p.hint),
      showReveal: false,
      revealItems: [],
      notInBookItems: [],
    });
    this.updateActionBar();
    this.renderBoard();
  },

  // ---------- 交互 ----------
  onBoardTap(e: any) {
    if (this.phase !== 'marking') return;
    const touch = e.changedTouches?.[0] ?? e.touches?.[0];
    if (!touch) return;
    // 触摸点相对 canvas，换算回逻辑坐标
    const x = touch.x / this.viewScale;
    const y = touch.y / this.viewScale;
    let col = Math.round((x - PAD) / CELL);
    let row = Math.round((y - PAD) / CELL);
    if (col < 0 || col > 8 || row < 0 || row > 9) return;
    if (Math.hypot(x - (PAD + col * CELL), y - (PAD + row * CELL)) > CELL * 0.48) return;
    // 黑先时棋盘翻转：视觉坐标 → 棋盘坐标
    const sq: Square =
      this.side === 'black' ? { row: 9 - row, col: 8 - col } : { row, col };
    this.handleSquareClick(sq);
  },

  ownPieceAt(sq: Square): boolean {
    const piece = this.board[sq.row][sq.col];
    return !!piece && pieceSide(piece) === this.side;
  },

  handleSquareClick(sq: Square) {
    if (this.phase !== 'marking') return;

    // 点击已标记的目标格：取消该标记
    const markIndex = this.marks.findIndex((m) => sameSquare(m.to, sq));
    if (markIndex >= 0) {
      this.marks.splice(markIndex, 1);
      this.selected = null;
      this.afterMarkChange();
      return;
    }

    if (this.selected) {
      // 再点一次选中的棋子：取消选中
      if (sameSquare(this.selected, sq)) {
        this.selected = null;
        this.afterMarkChange();
        return;
      }
      // 点击其他己方棋子：改选
      if (this.ownPieceAt(sq)) {
        this.selected = sq;
        this.afterMarkChange();
        return;
      }
      // 完整规则校验：不合法则不生成标记，目标格红闪提示
      if (this.marks.length >= MAX_MARKS) return;
      if (!isLegalMove(this.board, this.selected, sq)) {
        this.triggerFlash(sq);
        return;
      }
      const uci = squaresToUci(this.selected, sq);
      if (this.marks.some((m) => m.uci === uci)) {
        this.selected = null;
        this.afterMarkChange();
        return;
      }
      this.marks.push({ uci, from: this.selected, to: sq });
      this.selected = null;
      this.afterMarkChange();
      return;
    }

    if (this.ownPieceAt(sq)) {
      this.selected = sq;
      this.afterMarkChange();
    }
  },

  afterMarkChange() {
    this.updateActionBar();
    this.renderBoard();
  },

  // 目标格红闪 ~300ms，提示走法不合法
  triggerFlash(sq: Square) {
    clearTimeout(this.flashTimer);
    this.flash = sq;
    this.renderBoard();
    this.flashTimer = setTimeout(() => {
      this.flash = null;
      this.renderBoard();
    }, 300);
  },

  // 主操作按钮：提交 / 下一题同一位置，随阶段切换
  onAction() {
    if (this.phase === 'marking') {
      if (this.marks.length < 1) return;
      const result = scoreRound(this.puzzle!, this.marks);
      this.lastScored = result;
      this.phase = 'revealed';
      const totalScore = this.data.totalScore + result.total;
      this.setData({ totalScore });
      wx.setStorageSync(STORE_KEY, { totalScore, round: this.data.round });
      this.buildReveal(result);
      this.updateActionBar();
      this.renderBoard();
    } else {
      this.setData({ round: this.data.round + 1 });
      this.newPuzzle();
    }
  },

  // ---------- 揭晓面板 ----------
  buildReveal(result: { items: ScoredMark[]; total: number }) {
    const p = this.puzzle!;
    const marked = new Map(result.items.map((s) => [s.uci, s]));
    const revealItems: RevealItem[] = p.moves.map((m) => {
      const mark = marked.get(m.uci);
      return {
        uci: m.uci,
        chinese: uciToChinese(m.uci, this.board, this.side),
        winrate: m.winrate,
        pickRate:
          m.count != null && p.positionTotal
            ? Math.round((m.count / p.positionTotal) * 100)
            : 0,
        points: mark ? mark.points : 0,
        marked: !!mark,
        barClass: barClass(m.winrate),
      };
    });
    const notInBookItems = result.items
      .filter((s) => !s.inBook)
      .map((s) => ({
        uci: s.uci,
        chinese: uciToChinese(s.uci, this.board, this.side),
        winrate: 0,
        pickRate: 0,
        points: s.points,
        marked: false,
        barClass: '',
      }));
    this.setData({ showReveal: true, revealTitleHint: p.hint ?? '', revealItems, notInBookItems });
  },

  updateActionBar() {
    if (this.phase === 'marking') {
      const statusText = this.selected
        ? '点击目标格完成标记 · 点已标目标格可取消'
        : this.marks.length > 0
          ? `已标 ${this.marks.length}/${MAX_MARKS} · 可继续标记或提交`
          : `点击${this.side === 'red' ? '红' : '黑'}方棋子开始标记`;
      this.setData({
        statusText,
        statusIsScore: false,
        btnLabel: '提交',
        btnDisabled: this.marks.length < 1,
      });
    } else {
      this.setData({
        statusText: `本题得分 +${this.lastScored?.total ?? 0}`,
        statusIsScore: true,
        btnLabel: '下一题',
        btnDisabled: false,
      });
    }
  },

  // ---------- Canvas 渲染 ----------
  renderBoard() {
    const ctx = this.ctx;
    if (!ctx) return;
    const flipped = this.side === 'black';
    const px = (col: number) => PAD + (flipped ? 8 - col : col) * CELL;
    const py = (row: number) => PAD + (flipped ? 9 - row : row) * CELL;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const scale = this.viewScale * this.dpr;
    ctx.scale(scale, scale);

    // 底色 + 外框
    roundRectPath(ctx, 0, 0, BOARD_W, BOARD_H, 10);
    ctx.fillStyle = '#d9ac66';
    ctx.fill();
    roundRectPath(ctx, PAD - 10, PAD - 10, BOARD_W - 2 * PAD + 20, BOARD_H - 2 * PAD + 20, 4);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 横线 10 条
    ctx.beginPath();
    for (let r = 0; r <= 9; r++) {
      ctx.moveTo(PAD, PAD + r * CELL);
      ctx.lineTo(PAD + 8 * CELL, PAD + r * CELL);
    }
    // 竖线：两侧贯通，中间在楚河汉界处断开
    for (let c = 0; c <= 8; c++) {
      const x = PAD + c * CELL;
      if (c === 0 || c === 8) {
        ctx.moveTo(x, PAD);
        ctx.lineTo(x, PAD + 9 * CELL);
      } else {
        ctx.moveTo(x, PAD);
        ctx.lineTo(x, PAD + 4 * CELL);
        ctx.moveTo(x, PAD + 5 * CELL);
        ctx.lineTo(x, PAD + 9 * CELL);
      }
    }
    // 九宫斜线（棋盘线旋转对称，不随视角翻转）
    ctx.moveTo(PAD + 3 * CELL, PAD);
    ctx.lineTo(PAD + 5 * CELL, PAD + 2 * CELL);
    ctx.moveTo(PAD + 5 * CELL, PAD);
    ctx.lineTo(PAD + 3 * CELL, PAD + 2 * CELL);
    ctx.moveTo(PAD + 3 * CELL, PAD + 7 * CELL);
    ctx.lineTo(PAD + 5 * CELL, PAD + 9 * CELL);
    ctx.moveTo(PAD + 5 * CELL, PAD + 7 * CELL);
    ctx.lineTo(PAD + 3 * CELL, PAD + 9 * CELL);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 炮位/兵位角标
    ctx.beginPath();
    for (const { row, col } of STAR_POINTS) {
      const x = px(col);
      const y = py(row);
      const g = 4; // 离交叉点间隙
      const len = 9; // 角标长度
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        // 边线上的点不画越出棋盘的那一侧（翻转后视觉左右互换）
        const vdx = flipped ? -dx : dx;
        const vdy = flipped ? -dy : dy;
        if (x + vdx * (g + len) < PAD || x + vdx * (g + len) > PAD + 8 * CELL) continue;
        const x1 = x + vdx * g;
        const y1 = y + vdy * g;
        ctx.moveTo(x1, y1 + vdy * len);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 + vdx * len, y1);
      }
    }
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 楚河汉界
    ctx.fillStyle = 'rgba(107, 68, 35, 0.67)';
    ctx.font = '26px "Kaiti SC", "STKaiti", KaiTi, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚 河', PAD + 1.5 * CELL, PAD + 4.5 * CELL);
    ctx.fillText('漢 界', PAD + 6.5 * CELL, PAD + 4.5 * CELL);

    // 棋子
    const R = CELL * 0.42;
    const isMarkFrom = (sq: Square) => this.marks.some((m) => sameSquare(m.from, sq));
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = this.board[row][col];
        if (!piece) continue;
        const x = px(col);
        const y = py(row);
        const isRed = piece === piece.toUpperCase();
        const color = isRed ? PIECE_COLORS.red : PIECE_COLORS.black;

        // 选中环
        if (this.selected && sameSquare(this.selected, { row, col })) {
          ctx.beginPath();
          ctx.arc(x, y, R + 5, 0, Math.PI * 2);
          ctx.strokeStyle = '#2f9e6e';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        // 子体 + 内环 + 字
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = isMarkFrom({ row, col }) ? PIECE_COLORS.markedFrom : PIECE_COLORS.body;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, R - 3.5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = `600 ${Math.round(R * 1.15)}px "Kaiti SC", "STKaiti", KaiTi, serif`;
        ctx.fillText(pieceLabel(piece), x, y + 1);
      }
    }

    // 标记箭头：起点略出棋子边缘；终点指到目标棋子边缘（有子）或交叉点附近（空格）
    for (const m of this.marks) {
      const x1 = px(m.from.col);
      const y1 = py(m.from.row);
      const x2 = px(m.to.col);
      const y2 = py(m.to.row);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len === 0) continue;
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      let head = R + 4;
      let tail = this.board[m.to.row][m.to.col] ? R + 4 : 10;
      const maxSum = len * 0.9;
      if (head + tail > maxSum) {
        const k = maxSum / (head + tail);
        head *= k;
        tail *= k;
      }
      const ax = x1 + ux * head;
      const ay = y1 + uy * head;
      const bx = x2 - ux * tail;
      const by = y2 - uy * tail;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = 'rgba(77, 255, 136, 0.72)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
      // 箭头三角
      const tipX = bx + ux * 3;
      const tipY = by + uy * 3;
      const baseX = bx - ux * 9;
      const baseY = by - uy * 9;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX - uy * 5.5, baseY + ux * 5.5);
      ctx.lineTo(baseX + uy * 5.5, baseY - ux * 5.5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(77, 255, 136, 0.85)';
      ctx.fill();
    }

    // 标记徽章（目标格编号 1/2/3）
    this.marks.forEach((m, i) => {
      const bx = px(m.to.col) + 16;
      const by = py(m.to.row) - 16;
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#2f6f9f';
      ctx.fill();
      ctx.strokeStyle = '#dff0ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px sans-serif';
      ctx.fillText(String(i + 1), bx, by);
    });

    // 不合法目标格红闪
    if (this.flash) {
      ctx.beginPath();
      ctx.arc(px(this.flash.col), py(this.flash.row), CELL * 0.46, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 68, 68, 0.67)';
      ctx.fill();
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
});
