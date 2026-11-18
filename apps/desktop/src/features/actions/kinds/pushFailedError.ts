import type { MountId } from '@goodboy/types';
import { pushFailures } from './pushFailures';
import type { OnlineCommit } from '../../../store/runtime/worktreeStatuses/onlyOnline';

type Params = {
  readonly message: string;
  readonly mountId: MountId;
  readonly isForce: boolean;
  readonly confirmedOnlyOnline: ReadonlyArray<OnlineCommit> | null;
  readonly confirmedRemoteSha: string | null;
  readonly isOriginMoved?: boolean;
};

export type PushFailedError = Error & {
  readonly kind: 'push-failed';
  readonly mountId: MountId;
  readonly isForce: boolean;
  readonly confirmedOnlyOnline: ReadonlyArray<OnlineCommit> | null;
  readonly confirmedRemoteSha: string | null;
  readonly isOriginMoved: boolean;
};

export const pushFailedError = ({
  message,
  mountId,
  isForce,
  confirmedOnlyOnline,
  confirmedRemoteSha,
  isOriginMoved = false,
}: Params): PushFailedError => {
  const failure = Object.assign(new Error(message), {
    name: 'PushFailedError',
    kind: 'push-failed' as const,
    mountId,
    isForce,
    confirmedOnlyOnline,
    confirmedRemoteSha,
    isOriginMoved,
  });
  pushFailures.set(failure, failure);
  return failure;
};
