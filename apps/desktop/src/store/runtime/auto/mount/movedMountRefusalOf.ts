import type { AutoDelegation } from '@goodboy/db';
import type { PickableMount } from '@goodboy/core/auto';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';

type Params = {
  readonly slot: number;
  readonly retry: AutoDelegation | null;
  readonly mount: PickableMount;
};

export const movedMountRefusalOf = ({ slot, retry, mount }: Params) => {
  const capturedPath =
    retry === null ? null : textFieldOf({ source: retry.target, key: 'worktreePath' });
  if (capturedPath === null || mount.worktreePath === capturedPath) {
    return null;
  }
  return {
    slot,
    code: 'mount_missing',
    message:
      'the mount of the earlier attempt moved, so "retryOf" cannot repeat the work on it. Drop "retryOf" and send new work on the mount you want',
  } as const;
};
