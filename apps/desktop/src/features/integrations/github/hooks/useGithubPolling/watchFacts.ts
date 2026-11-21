import type { MountId, PullRequestChecks, SessionId } from '@goodboy/types';

export type WatchFact = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prNumber: number;
  readonly headSha: string;
  readonly checks: PullRequestChecks;
};
