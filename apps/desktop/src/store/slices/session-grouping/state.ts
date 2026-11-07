import type { SessionId } from '@goodboy/types';

export type GroupBy = 'branch' | 'state';

export type SessionGroupingState = {
  readonly groupBySession: Readonly<Record<SessionId, GroupBy>>;
};

export const sessionGroupingInitialState: SessionGroupingState = {
  groupBySession: {},
};
