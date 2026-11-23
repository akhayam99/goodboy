import { useCallback, useMemo, useState } from 'react';
import type { PrMergeMethod } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MergeTrain } from '../../../../../store/slices/pr-series/mergeTrain';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import type { ReadyCar } from '../../mergeOrderOf';
import { readyCarsOf } from '../../readyCarsOf';
import { readyLinesOf, type ReadyLine } from '../../readyLinesOf';
import type { ReadyRow } from '../../readyToMergeOf';

type Params = {
  readonly ready: ReadonlyArray<ReadyRow>;
  readonly sessionTitles: ReadonlyMap<string, string>;
};

type RowParams = {
  readonly sessionId: string;
};

export type MergeTrainControls = Readonly<{
  lines: ReadonlyArray<ReadyLine>;
  marked: ReadonlySet<string>;
  train: MergeTrain | null;
  method: PrMergeMethod;
  toggleMark: (params: RowParams) => void;
  start: () => void;
  stop: () => void;
  dismiss: () => void;
}>;

const METHOD: PrMergeMethod = 'squash';

export const useMergeTrain = ({ ready, sessionTitles }: Params): MergeTrainControls => {
  const signature = useAppStore((state) => JSON.stringify(readyCarsOf({ state, rows: ready })));
  const cars = useMemo((): ReadonlyArray<ReadyCar> => JSON.parse(signature), [signature]);
  const lines = useMemo(
    () => readyLinesOf({ rows: ready, cars, sessionTitles }),
    [cars, ready, sessionTitles],
  );
  const train = useAppStore((state) => state.mergeTrain);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const marked = useMemo(
    () =>
      new Set(
        lines.flatMap((line) =>
          line.car !== null && picked.has(line.sessionId) ? [line.sessionId] : [],
        ),
      ),
    [lines, picked],
  );

  const toggleMark = useCallback(
    ({ sessionId }: RowParams) => {
      if (train !== null) {
        return;
      }
      setPicked((current) => {
        const next = new Set(current);
        if (next.has(sessionId)) {
          next.delete(sessionId);
          return next;
        }
        next.add(sessionId);
        return next;
      });
    },
    [train],
  );

  const start = useCallback(() => {
    const chosen = lines.flatMap((line) =>
      line.car !== null && marked.has(line.sessionId) ? [line.car] : [],
    );
    if (chosen.length === 0) {
      return;
    }
    setPicked(new Set());
    const state = useAppStore.getState();
    void state
      .startMergeTrain({
        method: METHOD,
        cars: chosen.map((car) => ({
          sessionId: car.sessionId,
          mountId: car.mountId,
          prNumber: car.number,
          repo: car.repo,
          base: car.base,
        })),
      })
      .catch((error: unknown) =>
        state.reportError({ recovery: CHECK_STATE, title: "Couldn't merge in order", error }),
      );
  }, [lines, marked]);

  const stop = useCallback(() => {
    useAppStore.getState().stopMergeTrainAfterThis();
  }, []);

  const trainId = train?.id ?? null;
  const dismiss = useCallback(() => {
    if (trainId !== null) {
      useAppStore.getState().dismissMergeTrain({ id: trainId });
    }
  }, [trainId]);

  return { lines, marked, train, method: METHOD, toggleMark, start, stop, dismiss };
};
