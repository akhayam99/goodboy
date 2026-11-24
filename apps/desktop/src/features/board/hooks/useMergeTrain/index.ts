import { useCallback, useMemo } from 'react';
import type { PrMergeMethod } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MergeTrain } from '../../../../store/slices/pr-series/mergeTrain';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import type { ReadyCar } from '../../mergeTrain/mergeOrderOf';
import { readyCarsOf } from '../../mergeTrain/readyCarsOf';
import { readyLinesOf } from '../../mergeTrain/readyLinesOf';
import type { ReadyRow } from '../../mergeTrain/readyToMergeOf';

type Params = {
  readonly ready: ReadonlyArray<ReadyRow>;
  readonly sessionTitles: ReadonlyMap<string, string>;
};

export type MergeTrainControls = Readonly<{
  cars: ReadonlyArray<ReadyCar>;
  train: MergeTrain | null;
  method: PrMergeMethod;
  start: () => void;
  stop: () => void;
  dismiss: () => void;
}>;

const METHOD: PrMergeMethod = 'squash';

export const useMergeTrain = ({ ready, sessionTitles }: Params): MergeTrainControls => {
  const signature = useAppStore((state) => JSON.stringify(readyCarsOf({ state, rows: ready })));
  const readyCars = useMemo((): ReadonlyArray<ReadyCar> => JSON.parse(signature), [signature]);
  const lines = useMemo(
    () => readyLinesOf({ rows: ready, cars: readyCars, sessionTitles }),
    [readyCars, ready, sessionTitles],
  );
  const cars = useMemo(
    () => lines.flatMap((line) => (line.car === null ? [] : [line.car])),
    [lines],
  );
  const train = useAppStore((state) => state.mergeTrain);

  const start = useCallback(() => {
    if (cars.length === 0) {
      return;
    }
    const state = useAppStore.getState();
    void state
      .startMergeTrain({
        method: METHOD,
        cars: cars.map((car) => ({
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
  }, [cars]);

  const stop = useCallback(() => {
    useAppStore.getState().stopMergeTrainAfterThis();
  }, []);

  const trainId = train?.id ?? null;
  const dismiss = useCallback(() => {
    if (trainId !== null) {
      useAppStore.getState().dismissMergeTrain({ id: trainId });
    }
  }, [trainId]);

  return { cars, train, method: METHOD, start, stop, dismiss };
};
