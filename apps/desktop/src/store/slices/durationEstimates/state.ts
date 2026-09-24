import type { DurationHistory } from '@goodboy/core';
import type { MeasuredTurnSpan } from '@goodboy/types';

export type DurationEstimatesState = {
  readonly workspaceDurationHistory: Readonly<Record<string, DurationHistory>>;
  readonly sessionTurnSpans: Readonly<Record<string, ReadonlyArray<MeasuredTurnSpan>>>;
};

export const durationEstimatesInitialState: DurationEstimatesState = {
  workspaceDurationHistory: {},
  sessionTurnSpans: {},
};
