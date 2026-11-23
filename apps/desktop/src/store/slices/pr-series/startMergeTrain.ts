import type { PrMergeMethod } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { pullRequestPortFor } from '../review-source/pullRequestPortFor';
import { mergeInOrder, type MergeInOrderResult, type MergeStep } from './mergeInOrder';
import type { MergeTrain, MergeTrainCar, MergeTrainOutcome } from './mergeTrain';

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

type PatchParams = {
  readonly id: string;
  readonly patch: Partial<MergeTrain>;
};

type OutcomeParams = {
  readonly result: MergeInOrderResult;
};

const outcomeOf = ({ result }: OutcomeParams): MergeTrainOutcome => {
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
    const patchTrain = ({ id: trainId, patch }: PatchParams): void => {
      set((state) => {
        const train = state.mergeTrain;
        if (train === null || train.id !== trainId) {
          return {};
        }
        return { mergeTrain: { ...train, ...patch } };
      });
    };
    set({
      mergeTrain: {
        id,
        cars,
        method,
        index: 0,
        step: 'merging',
        hasUpdated: false,
        merged: 0,
        isStopRequested: false,
        outcome: null,
      },
    });
    let updatedIndex = -1;
    const onStep = ({ kind, index }: MergeStep): void => {
      if (kind === 'updating') {
        updatedIndex = index;
      }
      patchTrain({
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
    patchTrain({
      id,
      patch: { merged: result.merged, outcome: outcomeOf({ result }) },
    });
    return result;
  };
