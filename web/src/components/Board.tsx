import type { Board, GamePhase, MarkedMove, Side, Square } from '../../../core/types';
import { pieceSide, sameSquare } from '../../../core/fen';
import Piece from './Piece';

const CELL = 56;
const PAD = 40;
const WIDTH = PAD * 2 + CELL * 8;
const HEIGHT = PAD * 2 + CELL * 9;

// flipped=true 时棋盘旋转 180°（黑方视角：黑将在下），棋子/箭头/热区共用此映射
function px(col: number, flipped: boolean): number {
  return PAD + (flipped ? 8 - col : col) * CELL;
}
function py(row: number, flipped: boolean): number {
  return PAD + (flipped ? 9 - row : row) * CELL;
}

interface BoardProps {
  board: Board;
  side: Side; // 行棋方
  phase: GamePhase;
  selected: Square | null;
  marks: MarkedMove[];
  flash: Square | null; // 不合法走法的目标格红闪
  onSquareClick: (sq: Square) => void;
}

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

function StarMarker({ row, col, flipped }: Square & { flipped: boolean }) {
  const x = px(col, flipped);
  const y = py(row, flipped);
  const g = 4; // 离交叉点的间隙
  const len = 9; // 角标长度
  const segs: string[] = [];
  const dirs = [
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];
  for (const { dx, dy } of dirs) {
    // 边线上的点不画越出棋盘的那一侧（翻转后视觉左右互换，按视觉坐标判断）
    const vdx = flipped ? -dx : dx;
    const vdy = flipped ? -dy : dy;
    if (x + vdx * (g + len) < px(0, false) || x + vdx * (g + len) > px(8, false)) continue;
    const x1 = x + vdx * g;
    const y1 = y + vdy * g;
    segs.push(`M ${x1} ${y1 + vdy * len} L ${x1} ${y1} L ${x1 + vdx * len} ${y1}`);
  }
  return (
    <path
      key={`star-${row}-${col}`}
      d={segs.join(' ')}
      stroke="#6b4423"
      strokeWidth={1.4}
      fill="none"
    />
  );
}

export default function Board({ board, side, phase, selected, marks, flash, onSquareClick }: BoardProps) {
  // 视角跟随行棋方：黑先时黑将在下、红将在上
  const flipped = side === 'black';

  const lines: string[] = [];
  // 横线 10 条
  for (let r = 0; r <= 9; r++) {
    lines.push(`M ${px(0, false)} ${py(r, false)} L ${px(8, false)} ${py(r, false)}`);
  }
  // 竖线：两边贯通，中间在楚河汉界处断开
  for (let c = 0; c <= 8; c++) {
    if (c === 0 || c === 8) {
      lines.push(`M ${px(c, false)} ${py(0, false)} L ${px(c, false)} ${py(9, false)}`);
    } else {
      lines.push(`M ${px(c, false)} ${py(0, false)} L ${px(c, false)} ${py(4, false)}`);
      lines.push(`M ${px(c, false)} ${py(5, false)} L ${px(c, false)} ${py(9, false)}`);
    }
  }
  // 九宫斜线（棋盘线整体 180° 旋转对称，不随视角翻转）
  lines.push(`M ${px(3, false)} ${py(0, false)} L ${px(5, false)} ${py(2, false)}`);
  lines.push(`M ${px(5, false)} ${py(0, false)} L ${px(3, false)} ${py(2, false)}`);
  lines.push(`M ${px(3, false)} ${py(7, false)} L ${px(5, false)} ${py(9, false)}`);
  lines.push(`M ${px(5, false)} ${py(7, false)} L ${px(3, false)} ${py(9, false)}`);

  const isMarkFrom = (sq: Square) => marks.some((m) => sameSquare(m.from, sq));

  // 箭头：起点略出棋子边缘；终点指到目标棋子边缘（有子）或目标交叉点附近（空格）。
  // 极端短走法（一格吃子）两端缩进之和可能接近线段长度，按比例压缩防止首尾交叉反向。
  const PIECE_R = CELL * 0.42;
  const arrowSegment = (m: MarkedMove) => {
    const x1 = px(m.from.col, flipped);
    const y1 = py(m.from.row, flipped);
    const x2 = px(m.to.col, flipped);
    const y2 = py(m.to.row, flipped);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) return null;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    let head = PIECE_R + 4;
    let tail = board[m.to.row][m.to.col] ? PIECE_R + 4 : 10;
    const maxSum = len * 0.9;
    if (head + tail > maxSum) {
      const k = maxSum / (head + tail);
      head *= k;
      tail *= k;
    }
    return { x1: x1 + ux * head, y1: y1 + uy * head, x2: x2 - ux * tail, y2: y2 - uy * tail };
  };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="board-svg"
      role="img"
      aria-label="象棋棋盘"
    >
      <defs>
        <marker
          id="mark-arrowhead"
          markerWidth="12"
          markerHeight="9"
          refX="9"
          refY="4.5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points="0 0, 12 4.5, 0 9" className="mark-arrowhead" />
        </marker>
      </defs>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="board-bg" rx={10} />
      <rect
        x={PAD - 10}
        y={PAD - 10}
        width={WIDTH - 2 * PAD + 20}
        height={HEIGHT - 2 * PAD + 20}
        className="board-frame"
        rx={4}
      />
      <path d={lines.join(' ')} stroke="#6b4423" strokeWidth={1.5} fill="none" />
      {STAR_POINTS.map((sq) => (
        <StarMarker key={`${sq.row}-${sq.col}`} {...sq} flipped={flipped} />
      ))}
      <text x={px(1.5, flipped)} y={py(4.5, flipped)} className="river-text">
        楚 河
      </text>
      <text x={px(6.5, flipped)} y={py(4.5, flipped)} className="river-text">
        漢 界
      </text>

      {/* 棋子 */}
      {board.map((rowArr, row) =>
        rowArr.map((piece, col) => {
          if (!piece) return null;
          const sq = { row, col };
          return (
            <Piece
              key={`${row}-${col}`}
              piece={piece}
              x={px(col, flipped)}
              y={py(row, flipped)}
              radius={CELL * 0.42}
              selected={!!selected && sameSquare(selected, sq)}
              markedFrom={isMarkFrom(sq)}
            />
          );
        }),
      )}

      {/* 标记走法箭头（半透明，不挡棋子；取消标记即消失；揭示阶段保留） */}
      {marks.map((m) => {
        const seg = arrowSegment(m);
        if (!seg) return null;
        return (
          <line
            key={`arrow-${m.uci}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            className="mark-arrow"
            markerEnd="url(#mark-arrowhead)"
            pointerEvents="none"
          />
        );
      })}

      {/* 标记徽章（目标格编号 1/2/3，放在箭头终点附近） */}
      {marks.map((m, i) => (
        <g key={m.uci} pointerEvents="none">
          <circle cx={px(m.to.col, flipped) + 16} cy={py(m.to.row, flipped) - 16} r={11} className="mark-badge" />
          <text x={px(m.to.col, flipped) + 16} y={py(m.to.row, flipped) - 16} className="mark-badge-text">
            {i + 1}
          </text>
        </g>
      ))}

      {/* 不合法目标格红闪 */}
      {flash && (
        <circle
          cx={px(flash.col, flipped)}
          cy={py(flash.row, flipped)}
          r={CELL * 0.46}
          className="illegal-flash"
          pointerEvents="none"
        />
      )}

      {/* 点击热区 */}
      {board.map((rowArr, row) =>
        rowArr.map((_, col) => {
          const piece = board[row][col];
          const own = piece && pieceSide(piece) === side;
          return (
            <circle
              key={`hit-${row}-${col}`}
              cx={px(col, flipped)}
              cy={py(row, flipped)}
              r={CELL * 0.46}
              fill="transparent"
              className={
                phase === 'marking'
                  ? own
                    ? 'hit-area hit-own'
                    : 'hit-area'
                  : 'hit-area hit-disabled'
              }
              onClick={() => onSquareClick({ row, col })}
            />
          );
        }),
      )}
    </svg>
  );
}
