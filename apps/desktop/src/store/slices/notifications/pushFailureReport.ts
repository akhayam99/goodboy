import type { MountId, SessionId } from '@goodboy/types';
import type { ErrorRecovery } from './errorRecovery';
import { WORK_KEPT } from './errorRecovery';

type KeyParams = {
  readonly mountId: MountId;
};

export const pushFailureKeyOf = ({ mountId }: KeyParams): string => `push-failed:${mountId}`;

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly isRetryable: boolean;
};

export type PushFailureReport = {
  readonly sessionId: SessionId;
  readonly coalesceKey: string;
  readonly recovery: ErrorRecovery;
};

export const pushFailureReportOf = ({
  sessionId,
  mountId,
  isRetryable,
}: Params): PushFailureReport => ({
  sessionId,
  coalesceKey: pushFailureKeyOf({ mountId }),
  recovery: isRetryable
    ? { action: { kind: 'retry-push', sessionId, mountId }, clause: 'work-kept' }
    : WORK_KEPT,
});
