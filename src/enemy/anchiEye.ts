// Local cell-centre coordinates are shared by the engine and Canvas. A moving
// eye may be fractional, but its hit cell is always obtained from that sample.
export type AnchiEyePoint = { x: number; y: number };
export type AnchiEyeRect = AnchiEyePoint & { w: number; h: number };

export const ANCHI_EYE_TRAVEL_MS = 450;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const bounds = (w: number, h: number) => ({
  right: Math.max(0, Math.floor(w) - 1),
  // The entire lowest row, including its corners, is excluded unless h = 1.
  side: Math.max(0, Math.floor(h) - 2),
});

/** Valid integer targets, ordered up the left side and across/down the top/right. */
export function anchiEyeCells(w: number, h: number): AnchiEyePoint[] {
  const { right, side } = bounds(w, h);
  const cells: AnchiEyePoint[] = [];
  for (let y = side; y >= 0; y -= 1) cells.push({ x: 0, y });
  for (let x = 1; x <= right; x += 1) cells.push({ x, y: 0 });
  if (right > 0) for (let y = 1; y <= side; y += 1) cells.push({ x: right, y });
  return cells;
}

/** Closest valid point on the open U-shaped path, retaining sub-cell movement. */
export function projectAnchiEye(w: number, h: number, point: AnchiEyePoint): AnchiEyePoint {
  const { right, side } = bounds(w, h);
  if (right === 0) return { x: 0, y: clamp(point.y, 0, side) };
  const candidates = [
    { x: clamp(point.x, 0, right), y: 0 },
    { x: 0, y: clamp(point.y, 0, side) },
    { x: right, y: clamp(point.y, 0, side) },
  ];
  const distance = (candidate: AnchiEyePoint) => (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
  return candidates.reduce((nearest, candidate) => distance(candidate) < distance(nearest) ? candidate : nearest);
}

// The U has a single continuous arc coordinate. Interpolating it cannot cut
// through the body, wrap under it, or jump at the upper corners.
function arcAt(w: number, h: number, point: AnchiEyePoint): number {
  const { right, side } = bounds(w, h);
  if (right === 0 || point.x === 0) return side - point.y;
  return side + point.x + (point.x === right ? point.y : 0);
}

function pointAt(w: number, h: number, arc: number): AnchiEyePoint {
  const { right, side } = bounds(w, h);
  if (right === 0 || arc <= side) return { x: 0, y: side - arc };
  if (arc <= side + right) return { x: arc - side, y: 0 };
  return { x: right, y: arc - side - right };
}

/** Sample engine-owned progress (0..1), with gentle acceleration/deceleration. */
export function sampleAnchiEyePath(w: number, h: number, from: AnchiEyePoint, to: AnchiEyePoint, progress: number): AnchiEyePoint {
  const start = projectAnchiEye(w, h, from);
  const end = projectAnchiEye(w, h, to);
  const p = clamp(progress, 0, 1);
  if (p === 0) return start;
  if (p === 1) return end;
  const eased = p * p * (3 - 2 * p);
  const startArc = arcAt(w, h, start);
  return pointAt(w, h, startArc + (arcAt(w, h, end) - startArc) * eased);
}

/** Quantize the same displayed centre for attacks, including while in transit. */
export function anchiEyeCell(w: number, h: number, point: AnchiEyePoint): AnchiEyePoint {
  const projected = projectAnchiEye(w, h, point);
  return { x: Math.floor(projected.x + 0.5), y: Math.floor(projected.y + 0.5) };
}

/** Growth may move the body origin left/up: preserve the world position first. */
export function remapAnchiEye(point: AnchiEyePoint, oldRect: AnchiEyeRect, newRect: AnchiEyeRect): AnchiEyePoint {
  return projectAnchiEye(newRect.w, newRect.h, {
    x: oldRect.x + point.x - newRect.x,
    y: oldRect.y + point.y - newRect.y,
  });
}
