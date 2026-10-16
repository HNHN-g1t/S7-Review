import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { moveThunderTrace, startThunderTrace, type ThunderTrace, type ThunderTracePoint } from './thunderTrace';
import type { You456Set } from './you456';

type Options = {
  set: You456Set | null; board: ReadonlyArray<ReadonlyArray<{ id: string } | null>>;
  run: number; status: string; boardRef: RefObject<HTMLElement | null>;
  canStart: () => boolean; fire: () => void;
};
export function useYou456Gesture(options: Options) {
  const latest = useRef(options); latest.current = options;
  const trace = useRef<ThunderTrace | null>(null), owner = useRef<number | null>(null);
  const [trail, setTrail] = useState<readonly ThunderTracePoint[]>([]);
  const epoch = () => {
    const o = latest.current;
    return `${o.run}:${(o.set ?? []).map(p => `${p.x},${p.y}:${o.board[p.y]?.[p.x]?.id ?? ''}`).join('|')}`;
  };
  const reset = useCallback(() => {
    const id = owner.current, board = latest.current.boardRef.current;
    trace.current = null; owner.current = null; setTrail([]);
    if (id !== null && board?.hasPointerCapture(id)) board.releasePointerCapture(id);
  }, []);
  const currentEpoch = epoch();
  useLayoutEffect(() => {
    if (trace.current && (options.status !== 'playing' || trace.current.epoch !== currentEpoch)) reset();
    return undefined;
  }, [options.status, currentEpoch, reset]);
  useLayoutEffect(() => () => { trace.current = null; owner.current = null; }, []);
  const pointAt = (e: PointerEvent<HTMLElement>) => {
    const rect = latest.current.boardRef.current?.querySelector('[data-cell="0,0"]')?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height } : null;
  };
  const keyAt = (p: ThunderTracePoint | null) => p && p.x >= 0 && p.y >= 0 && p.x < 7 && p.y < 14 ? `${Math.floor(p.x)},${Math.floor(p.y)}` : null;
  return {
    trail,
    down(e: PointerEvent<HTMLElement>) {
      const o = latest.current;
      if (owner.current !== null) return true;
      if (o.status !== 'playing' || !o.canStart() || e.isPrimary === false || e.button !== 0) return false;
      const p = pointAt(e), keys = o.set?.map(p => `${p.x},${p.y}`) as [string, string, string] | undefined;
      const started = p ? startThunderTrace(e.pointerId, epoch(), keys ?? null, keyAt(p), p) : null;
      if (!started) return false;
      owner.current = e.pointerId; trace.current = started; setTrail(started.points);
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return true;
    },
    move(e: PointerEvent<HTMLElement>) {
      if (owner.current === null) return false;
      if (owner.current !== e.pointerId) return true;
      if (!trace.current) return true;
      const p = pointAt(e), active = trace.current;
      const step = moveThunderTrace(active, epoch(), keyAt(p), p ?? active.points[active.points.length - 1]);
      trace.current = step.trace; setTrail(step.trace?.points ?? []);
      if (step.result === 'complete') latest.current.fire();
      return true;
    },
    up(e: PointerEvent<HTMLElement>) {
      if (owner.current === null) return false;
      if (owner.current === e.pointerId) reset();
      return true;
    },
    cancel(e: PointerEvent<HTMLElement>) {
      if (owner.current === e.pointerId) reset();
    },
  };
}
