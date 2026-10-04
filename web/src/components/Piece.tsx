const RED_NAMES: Record<string, string> = {
  K: '帥',
  A: '仕',
  B: '相',
  R: '俥',
  N: '傌',
  C: '炮',
  P: '兵',
};

const BLACK_NAMES: Record<string, string> = {
  k: '將',
  a: '士',
  b: '象',
  r: '車',
  n: '馬',
  c: '砲',
  p: '卒',
};

export function pieceLabel(piece: string): string {
  return RED_NAMES[piece] ?? BLACK_NAMES[piece] ?? piece;
}

interface PieceProps {
  piece: string;
  x: number;
  y: number;
  radius: number;
  selected?: boolean;
  markedFrom?: boolean;
}

export default function Piece({ piece, x, y, radius, selected, markedFrom }: PieceProps) {
  const isRed = piece === piece.toUpperCase();
  const color = isRed ? '#c92b1f' : '#1d1a16';
  return (
    <g className="piece" pointerEvents="none">
      {selected && (
        <circle cx={x} cy={y} r={radius + 5} className="piece-selection" />
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        className="piece-body"
        stroke={color}
        fill={markedFrom ? '#ffe9b8' : undefined}
      />
      <circle cx={x} cy={y} r={radius - 3.5} fill="none" stroke={color} strokeWidth={1} opacity={0.7} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={radius * 1.15}
        fill={color}
        className="piece-text"
      >
        {pieceLabel(piece)}
      </text>
    </g>
  );
}
