import type { SessionId } from '@goodboy/types';

export type ThreadReadTimes = Readonly<Record<string, number>>;

export type ThreadReadsState = {
  readonly sessionThreadReads: Readonly<Record<SessionId, ThreadReadTimes>>;
};

export const threadReadsInitialState: ThreadReadsState = {
  sessionThreadReads: {},
};
