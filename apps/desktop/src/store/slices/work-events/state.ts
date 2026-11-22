import type { WorkEvent } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';

export type WorkEventsState = {
  readonly workEvents: Readonly<Record<SessionId, ReadonlyArray<WorkEvent> | undefined>>;
  readonly workEventsError: Readonly<Record<SessionId, string | undefined>>;
};

export const workEventsInitialState: WorkEventsState = {
  workEvents: {},
  workEventsError: {},
};
