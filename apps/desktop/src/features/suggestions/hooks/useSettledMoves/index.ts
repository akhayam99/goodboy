import { useEffect, useRef, useState } from 'react';
import {
  EMPTY_SETTLE,
  nextSettleState,
  type SettleState,
  type SettledRow,
} from '../../nextSettleState';
import type { NextStepSignals } from '../../nextStepSignals';
import type { NextMove } from '../../types';

type Params = {
  readonly moves: ReadonlyArray<NextMove>;
  readonly signals: NextStepSignals;
};

const NO_ROWS: ReadonlyArray<SettledRow> = [];

export const useSettledMoves = ({ moves, signals }: Params): ReadonlyArray<SettledRow> => {
  const stateRef = useRef<SettleState>(EMPTY_SETTLE);
  const [rows, setRows] = useState<ReadonlyArray<SettledRow>>(NO_ROWS);

  useEffect(() => {
    const next = nextSettleState({ state: stateRef.current, moves, signals, now: Date.now() });
    stateRef.current = next;
    setRows(next.rows.length === 0 ? NO_ROWS : next.rows);
  }, [moves, signals]);

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    const soonest = Math.min(...rows.map((row) => row.until));
    const timer = setTimeout(
      () => {
        const live = stateRef.current.rows.filter((row) => row.until > Date.now());
        stateRef.current = { ...stateRef.current, rows: live };
        setRows(live.length === 0 ? NO_ROWS : live);
      },
      Math.max(0, soonest - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [rows]);

  return rows;
};
