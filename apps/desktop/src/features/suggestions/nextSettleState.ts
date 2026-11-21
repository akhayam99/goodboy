import { isMoveDone } from './isMoveDone';
import type { NextStepSignals } from './nextStepSignals';
import { settledTextOf } from './settledTextOf';
import type { NextMove } from './types';

export const SETTLE_MS = 2_000;

export type SettledRow = {
  readonly id: string;
  readonly kind: NextMove['kind'];
  readonly text: string;
  readonly until: number;
};

export type SettleState = {
  readonly seen: ReadonlyMap<string, NextMove>;
  readonly rows: ReadonlyArray<SettledRow>;
};

export const EMPTY_SETTLE: SettleState = { seen: new Map(), rows: [] };

type Params = {
  readonly state: SettleState;
  readonly moves: ReadonlyArray<NextMove>;
  readonly signals: NextStepSignals;
  readonly now: number;
};

export const nextSettleState = ({ state, moves, signals, now }: Params): SettleState => {
  const current = new Map(moves.map((move) => [move.id, move]));
  const dismissed = signals.dismissedFingerprints ?? new Set<string>();
  const added = [...state.seen.values()].flatMap((move): ReadonlyArray<SettledRow> => {
    const isGone = !current.has(move.id);
    const isDone = isMoveDone({ completesWhen: move.completesWhen, signals });
    if (!isGone || !isDone || dismissed.has(move.fingerprint)) {
      return [];
    }
    return [
      { id: move.id, kind: move.kind, text: settledTextOf({ move }), until: now + SETTLE_MS },
    ];
  });
  const kept = state.rows.filter((row) => row.until > now && !current.has(row.id));
  return {
    seen: current,
    rows: [...kept, ...added.filter((row) => !kept.some((held) => held.id === row.id))],
  };
};
