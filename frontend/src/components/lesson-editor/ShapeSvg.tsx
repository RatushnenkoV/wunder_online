import type { SlideBlock } from '../../types';

function starPoints(n: number, outerR: number, innerR: number, cx: number, cy: number): string {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

export default function ShapeSvg({ w, h, block }: { w: number; h: number; block: Partial<SlideBlock> }) {
  const { shape = 'rect', fillColor = '#6366f1', strokeColor = 'transparent', strokeWidth = 3 } = block;

  const fill   = fillColor   === 'transparent' ? 'none' : fillColor;
  const stroke = strokeColor === 'transparent' ? 'none' : strokeColor;
  const sw = Math.max(0, strokeWidth ?? 3);
  const half = sw / 2;

  let el: React.ReactNode;
  switch (shape) {
    case 'circle':
      el = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(1, w / 2 - half)} ry={Math.max(1, h / 2 - half)}
              fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case 'triangle':
      el = <polygon points={`${w / 2},${half} ${w - half},${h - half} ${half},${h - half}`}
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    case 'diamond':
      el = <polygon points={`${w / 2},${half} ${w - half},${h / 2} ${w / 2},${h - half} ${half},${h / 2}`}
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    case 'star': {
      const minDim = Math.min(w, h);
      const outerR = Math.max(1, minDim / 2 - half);
      const innerR = outerR * 0.4;
      el = <polygon points={starPoints(5, outerR, innerR, w / 2, h / 2)}
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    }
    case 'line':
      el = <line x1={half} y1={h / 2} x2={w - half} y2={h / 2}
              stroke={strokeColor === 'transparent' ? '#6366f1' : stroke}
              strokeWidth={Math.max(sw, 1)} strokeLinecap="round" />;
      break;
    default: // rect
      el = <rect x={half} y={half} width={Math.max(1, w - sw)} height={Math.max(1, h - sw)}
              fill={fill} stroke={stroke} strokeWidth={sw} rx={2} />;
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      {el}
    </svg>
  );
}
