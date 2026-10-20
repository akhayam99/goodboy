import type { ResultPublish } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { AutoPorts, PushBranchOutcome } from './ports';

export type ExecutePublishParams = Readonly<{
  ports: AutoPorts;
  sessionId: SessionId;
  mountId: string;
  worktreePath: string;
  record: ResultPublish;
}>;

type FailedParams = {
  readonly record: ResultPublish;
  readonly message: string;
  readonly isRetryable: boolean;
};

const failed = ({ record, message, isRetryable }: FailedParams): ResultPublish => ({
  ...record,
  state: 'failed',
  message,
  isRetryable,
  isConfirmed: true,
  tries: record.tries + 1,
});

type PushedParams = {
  readonly record: ResultPublish;
};

const pushed = ({ record }: PushedParams): ResultPublish => ({
  ...record,
  state: 'pushed',
  message: null,
  isRetryable: false,
  isConfirmed: true,
  tries: record.tries + 1,
});

type PushParams = ExecutePublishParams & {
  readonly branch: string;
  readonly sha: string;
};

const pushOf = async ({
  ports,
  sessionId,
  mountId,
  worktreePath,
  record,
  branch,
  sha,
}: PushParams): Promise<PushBranchOutcome> => {
  try {
    return await ports.pushBranch({
      sessionId,
      mountId,
      worktreePath,
      branch,
      sha,
      leaseSha: record.leaseSha,
      isForce: record.mode === 'force',
    });
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
};

type OnlineParams = {
  readonly ports: AutoPorts;
  readonly worktreePath: string;
  readonly branch: string;
};

const onlineShaOf = async ({
  ports,
  worktreePath,
  branch,
}: OnlineParams): Promise<string | null> => {
  try {
    const read = await ports.readRemoteHead({ worktreePath, branch });
    return read.kind === 'sha' ? read.sha : null;
  } catch {
    return null;
  }
};

export const executePublish = async (params: ExecutePublishParams): Promise<ResultPublish> => {
  const { ports, worktreePath, record } = params;
  const { branch, sha } = record;
  if (branch === null || sha === null) {
    return failed({
      record,
      message: 'the branch or the checked commit is unknown',
      isRetryable: false,
    });
  }
  if ((await onlineShaOf({ ports, worktreePath, branch })) === sha) {
    return pushed({ record });
  }
  const outcome = await pushOf({ ...params, branch, sha });
  if (outcome.kind === 'pushed') {
    return pushed({ record });
  }
  if (outcome.kind === 'stale') {
    return failed({ record, message: outcome.message, isRetryable: true });
  }
  if ((await onlineShaOf({ ports, worktreePath, branch })) === sha) {
    return pushed({ record });
  }
  return failed({ record, message: outcome.message, isRetryable: true });
};
