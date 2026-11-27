import type { MountId, SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number;
};

const SEPARATOR = '/';

export const pullRequestReminderIdOf = ({ sessionId, mountId, prNumber }: Params): string =>
  [sessionId, mountId ?? '', String(prNumber)].join(SEPARATOR);
