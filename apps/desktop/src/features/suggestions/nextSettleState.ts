import { isMoveDone } from './isMoveDone';
import type { NextStepSignals } from './nextStepSignals';
import { settledTextOf } from './settledTextOf';
import type { NextMove } from './types';

export const SETTLE_MS = 2_000;

export const HOLD_MS = 30 * 60 * 1_000;

export type SettledRow = {
  readonly id: string;
  readonly kind: NextMove['kind'];
  readonly text: string;
  readonly until: number;
};

export type SettleState = {
  readonly seen: ReadonlyMap<string, NextMove>;
  readonly heldSince: ReadonlyMap<string, number>;
  readonly rows: ReadonlyArray<SettledRow>;
};

export const EMPTY_SETTLE: SettleState = { seen: new Map(), heldSince: new Map(), rows: [] };

type Params = {
  readonly state: SettleState;
  readonly moves: ReadonlyArray<NextMove>;
  readonly signals: NextStepSignals;
  readonly now: number;
};

export const nextSettleState = ({ state, moves, signals, now }: Params): SettleState => {
  const current = new Map(moves.map((move) => [move.id, move]));
  const currentTargets = new Set(
    moves.flatMap((move) => (move.targetKey === null ? [] : [move.targetKey])),
  );
  const dismissed = signals.dismissedFingerprints ?? new Set<string>();
  const added: SettledRow[] = [];
  const held = new Map<string, NextMove>();
  const heldSince = new Map<string, number>();
  for (const move of state.seen.values()) {
    if (current.has(move.id)) {
      continue;
    }
    if (dismissed.has(move.fingerprint)) {
      continue;
    }
    if (isMoveDone({ completesWhen: move.completesWhen, signals })) {
      added.push({
        id: move.id,
        kind: move.kind,
        text: settledTextOf({ move }),
        until: now + SETTLE_MS,
      });
      continue;
    }
    const since = state.heldSince.get(move.id) ?? now;
    const isSuperseded = move.targetKey !== null && currentTargets.has(move.targetKey);
    if (isSuperseded || now - since > HOLD_MS) {
      continue;
    }
    held.set(move.id, move);
    heldSince.set(move.id, since);
  }
  const kept = state.rows.filter((row) => row.until > now && !current.has(row.id));
  return {
    seen: new Map([...held, ...current]),
    heldSince,
    rows: [...kept, ...added.filter((row) => !kept.some((held) => held.id === row.id))],
  };
};
