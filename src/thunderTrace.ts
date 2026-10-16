// A trace belongs to one pointer, one set of dice, and one uninterrupted gesture.
export type ThunderTracePoint = { x: number; y: number };
export type ThunderTrace = {
  id: number;
  epoch: string;
  keys: readonly [string, string, string];
  reached: 1 | 2;
  points: readonly ThunderTracePoint[];
};

const MAX_TRAIL_POINTS = 160;

export function startThunderTrace(
  id: number,
  epoch: string,
  keys: readonly [string, string, string] | null,
  key: string | null,
  point: ThunderTracePoint,
): ThunderTrace | null {
  if (!keys || key !== keys[0]) return null;
  return { id, epoch, keys, reached: 1, points: [point] };
}

type TraceStep = {
  trace: ThunderTrace | null;
  result: 'continue' | 'complete' | 'cancel';
  tone: 1 | 2 | null;
};

export function moveThunderTrace(
  trace: ThunderTrace,
  epoch: string,
  key: string | null,
  point: ThunderTracePoint,
): TraceStep {
  // Dwell on the current die, or move to exactly the next one. Backtracking,
  // skipping, leaving the set/board, and replacing the dice all cancel it.
  if (trace.epoch !== epoch || (key !== trace.keys[trace.reached - 1] && key !== trace.keys[trace.reached])) {
    return { trace: null, result: 'cancel', tone: null };
  }
  const advanced = key === trace.keys[trace.reached];
  if (advanced && trace.reached === 2) return { trace: null, result: 'complete', tone: 2 };
  const last = trace.points[trace.points.length - 1];
  const points = Math.hypot(point.x - last.x, point.y - last.y) < 0.025
    ? trace.points
    : [...trace.points.slice(-(MAX_TRAIL_POINTS - 1)), point];
  return {
    trace: { ...trace, reached: advanced ? 2 : trace.reached, points },
    result: 'continue',
    tone: advanced ? 1 : null,
  };
}
