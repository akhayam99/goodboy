import type { MountId, PrMergeMethod, SessionId } from '@goodboy/types';
import type { MergeStepKind } from './mergeInOrder';

export type MergeTrainCar = Readonly<{
  sessionId: SessionId;
  mountId: MountId;
  prNumber: number;
  repo: string;
  base: string;
}>;

export type MergeTrainOutcome =
  | Readonly<{ kind: 'done' }>
  | Readonly<{ kind: 'halted' }>
  | Readonly<{ kind: 'stopped'; reason: string; isWithLead: boolean }>;

export type MergeTrain = Readonly<{
  id: string;
  cars: ReadonlyArray<MergeTrainCar>;
  method: PrMergeMethod;
  index: number;
  step: MergeStepKind;
  hasUpdated: boolean;
  merged: number;
  isStopRequested: boolean;
  outcome: MergeTrainOutcome | null;
}>;
