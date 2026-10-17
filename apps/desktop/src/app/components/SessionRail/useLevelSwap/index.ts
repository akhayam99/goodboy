import { useEffect, useRef, useState, type RefObject } from 'react';
import { LEVEL_MS, canAnimate, exitSnapshotOf, type ExitSnapshot } from '@goodboy/ui';
import type { RailLevel } from '../../../../store/slices/navigation/railLevel';

export type LevelDirection = 'forward' | 'back';

export type LevelGhostModel = {
  readonly id: number;
  readonly snapshot: ExitSnapshot;
  readonly direction: LevelDirection;
};

type Params = {
  readonly shown: RailLevel;
  readonly elementsRef: RefObject<ReadonlyMap<RailLevel, HTMLElement>>;
};

export type LevelSwap = {
  readonly entry: LevelDirection | null;
  readonly ghost: LevelGhostModel | null;
};

type SwapRecord = {
  readonly shown: RailLevel;
  readonly entry: LevelDirection | null;
  readonly ghost: LevelGhostModel | null;
  readonly count: number;
};

const DEPTH: Readonly<Record<RailLevel, number>> = {
  session: 0,
  worktree: 1,
  run: 1,
  auto: 1,
};

type DirectionParams = {
  readonly from: RailLevel;
  readonly to: RailLevel;
};

const directionOf = ({ from, to }: DirectionParams): LevelDirection =>
  DEPTH[to] < DEPTH[from] ? 'back' : 'forward';

export const useLevelSwap = ({ shown, elementsRef }: Params): LevelSwap => {
  const recordRef = useRef<SwapRecord>({ shown, entry: null, ghost: null, count: 0 });
  const [settledId, setSettledId] = useState(0);
  const record = recordRef.current;
  if (record.shown !== shown) {
    const element = elementsRef.current.get(record.shown) ?? null;
    const canMove = canAnimate({ element });
    const direction = directionOf({ from: record.shown, to: shown });
    const snapshot = canMove ? exitSnapshotOf({ element }) : null;
    const count = record.count + 1;
    recordRef.current = {
      shown,
      entry: canMove ? direction : null,
      ghost: snapshot === null ? null : { id: count, snapshot, direction },
      count,
    };
  }
  const current = recordRef.current;
  const ghost = current.ghost !== null && current.ghost.id !== settledId ? current.ghost : null;

  useEffect(() => {
    if (ghost === null) {
      return;
    }
    const timer = window.setTimeout(() => setSettledId(ghost.id), LEVEL_MS);
    return () => window.clearTimeout(timer);
  }, [ghost]);

  return { entry: current.entry, ghost };
};
