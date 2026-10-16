import { createElement as el, type CSSProperties } from 'react';
import './slimeBurst.css';

export type SlimeBurstKind = 'orange' | 'lime' | 'paint';
const SPLASHES = [
  'M-10-3Q-7-11-1-6Q4-12 7-5Q14-4 9 2Q13 9 4 7Q-2 13-5 6Q-14 8-10-3Z',
  'M-12-2Q-7-8-3-5Q2-11 5-5Q13-6 11 0Q17 4 7 5Q4 11-2 6Q-13 9-12-2Z',
  'M-8-5Q-1-10 3-4Q11-7 9 1Q15 7 6 6Q1 12-4 6Q-14 7-8-5Z',
];
// Fixed trajectories: no per-frame JS or random layout changes on re-render.
export function SlimeBurst({ kind, paused = false }: { kind: SlimeBurstKind; paused?: boolean }) {
  const paint = kind === 'paint';
  const count = paint ? 32 : 24;
  const colors = kind === 'lime' ? ['#c4ff32', '#deff69', '#9ff02b'] : ['#ffab32', '#ffd05a', '#e88424'];
  return el('svg', {
    'aria-hidden': true, className: `slime-burst is-${kind}`, viewBox: '0 0 100 100', preserveAspectRatio: 'none',
  }, Array.from({ length: count }, (_, i) => {
    const angle = i * 2.399963;
    const radius = 38 + (i % 5) * 7;
    const size = (paint ? 0.5 : 0.65) + (i % 4) * 0.14;
    return el('g', {
      key: i, className: 'slime-burst-piece', style: {
        '--sx': `${50 + Math.cos(angle) * (i % 3) * 7}px`,
        '--sy': `${50 + Math.sin(angle) * (i % 3) * 7}px`,
        '--dx': `${Math.cos(angle) * radius}px`,
        '--dy': `${Math.sin(angle) * radius - 12}px`,
        '--turn': `${(i % 2 ? 1 : -1) * (40 + i * 9)}deg`,
        '--lag': `${i % 4 * 8}ms`, animationPlayState: paused ? 'paused' : 'running',
      } as CSSProperties,
    }, el('g', { transform: `scale(${size})`, fill: paint ? '#fff' : colors[i % colors.length] },
      paint ? [
        el('path', { key: 'blob', d: SPLASHES[i % SPLASHES.length] }),
        el('ellipse', { key: 'drop', cx: 15, cy: -6, rx: 2.4, ry: 1.6 }),
        el('circle', { key: 'speck', cx: -13, cy: 10, r: 1.8 }),
      ] : el('path', { d: i % 2 ? 'M-8-5L4-8L9-1L6 7L-5 8L-9 1Z' : 'M-7-7L5-8L8-4L7 7L-6 8L-9 3Z' }),
    ));
  }));
}
