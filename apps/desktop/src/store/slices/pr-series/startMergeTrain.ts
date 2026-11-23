import type { PrMergeMethod } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { pullRequestPortFor } from '../review-source/pullRequestPortFor';
import { mergeInOrder, type MergeInOrderResult, type MergeStep } from './mergeInOrder';
import type { MergeTrainCar, MergeTrainOutcome } from './mergeTrain';
import { openMergeTrain } from './openMergeTrain';
import { patchMergeTrain } from './patchMergeTrain';

export type StartMergeTrainParams = Readonly<{
  cars: ReadonlyArray<MergeTrainCar>;
  method: PrMergeMethod;
}>;

export type StartMergeTrainResult =
  Readonly<{ kind: 'busy' }> | Readonly<{ kind: 'empty' }> | MergeInOrderResult;

type Deps = SliceDeps & {
  readonly portFor?: typeof pullRequestPortFor;
  readonly sleep?: Parameters<typeof mergeInOrder>[0]['sleep'];
};

type OutcomeParams = {
  readonly result: MergeInOrderResult;
};

const trainOutcomeOf = ({ result }: OutcomeParams): MergeTrainOutcome => {
  if (result.kind === 'stopped') {
    return { kind: 'stopped', reason: result.reason, isWithLead: result.isWithLead };
  }
  return { kind: result.kind };
};

export const startMergeTrain =
  ({ set, get, portFor, sleep }: Deps) =>
  async ({ cars, method }: StartMergeTrainParams): Promise<StartMergeTrainResult> => {
    const live = get().mergeTrain;
    if (live !== null && live.outcome === null) {
      return { kind: 'busy' };
    }
    if (cars.length === 0) {
      return { kind: 'empty' };
    }
    const id = crypto.randomUUID();
    openMergeTrain({ set, id, cars, method });
    let updatedIndex = -1;
    const onStep = ({ kind, index }: MergeStep): void => {
      if (kind === 'updating') {
        updatedIndex = index;
      }
      patchMergeTrain({
        set,
        id,
        patch: { step: kind, index, merged: index, hasUpdated: updatedIndex === index },
      });
    };
    const result = await mergeInOrder({
      get,
      ...(portFor === undefined ? {} : { portFor }),
      ...(sleep === undefined ? {} : { sleep }),
    })({
      entries: cars.map((car) => ({
        sessionId: car.sessionId,
        mountId: car.mountId,
        prNumber: car.prNumber,
        label: `#${car.prNumber}`,
      })),
      method,
      shouldUpdate: true,
      shouldWait: true,
      shouldHandConflicts: true,
      shouldStop: () => {
        const train = get().mergeTrain;
        return train !== null && train.id === id && train.isStopRequested;
      },
      onStep,
    });
    patchMergeTrain({
      set,
      id,
      patch: { merged: result.merged, outcome: trainOutcomeOf({ result }) },
    });
    return result;
  };
