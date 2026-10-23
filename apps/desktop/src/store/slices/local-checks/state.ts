import type { MountId } from '@goodboy/types';

type LocalCheckOutcome = 'passed' | 'declined';

export type LocalCheckResult = {
  readonly outcome: LocalCheckOutcome;
  readonly at: number;
  readonly message: string | null;
};

export type LocalChecksState = {
  readonly mountLocalChecks: Readonly<Partial<Record<MountId, LocalCheckResult>>>;
};

export const localChecksInitialState: LocalChecksState = {
  mountLocalChecks: {},
};
