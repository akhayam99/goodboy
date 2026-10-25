import {
  CHECKS_RED_HOLD,
  publishGateOf,
  type DelegatePublish,
  type RemoteRead,
  type ResultChecksRun,
  type ResultPublish,
} from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { snapshotOf } from './attemptBaseline';
import type { AutoPorts } from './ports';

export type PlanPublishParams = Readonly<{
  ports: AutoPorts;
  worktreePath: string;
  branch: string | null;
  wanted: DelegatePublish;
  baseline: unknown;
  remote: RemoteRead | null;
  outcome: string;
  exit: string;
  completion: string;
  checksRun: ResultChecksRun | null;
  endHead: string | null;
  tries: number;
}>;

const CONTENT_CHANGED =
  'a force push is for work that rewrites history and keeps the files as they were. The brief did not say the files change, so nothing was pushed';

type HeldParams = {
  readonly wanted: DelegatePublish;
  readonly branch: string | null;
  readonly sha: string | null;
  readonly message: string;
  readonly isRetryable: boolean;
  readonly tries: number;
};

const held = ({ wanted, branch, sha, message, isRetryable, tries }: HeldParams): ResultPublish => ({
  mode: wanted.mode,
  state: 'failed',
  branch,
  sha,
  leaseSha: null,
  backupRef: null,
  message,
  isRetryable,
  isConfirmed: false,
  tries,
  reviewerReportId: wanted.reviewerReportId,
  isContentChanging: wanted.isContentChanging,
});

type TreeParams = {
  readonly ports: AutoPorts;
  readonly worktreePath: string;
  readonly base: string;
  readonly head: string;
};

const isSameTree = async ({
  ports,
  worktreePath,
  base,
  head,
}: TreeParams): Promise<boolean | null> => {
  if (base === head) {
    return true;
  }
  try {
    return (await ports.readCommittedFiles({ worktreePath, base, head })).length === 0;
  } catch {
    return null;
  }
};

export const planPublish = async (params: PlanPublishParams): Promise<ResultPublish> => {
  const { ports, worktreePath, branch, wanted, baseline, checksRun, tries } = params;
  const gate = publishGateOf({
    outcome: params.outcome,
    exit: params.exit,
    completion: params.completion,
    checksVerdict: checksRun?.verdict ?? null,
  });
  const sha = checksRun?.commit ?? params.endHead;
  if (gate.kind === 'held') {
    return held({
      wanted,
      branch,
      sha,
      message: gate.message,
      isRetryable: gate.message === CHECKS_RED_HOLD,
      tries,
    });
  }
  if (branch === null || sha === null) {
    return held({
      wanted,
      branch,
      sha,
      message: 'the branch or the checked commit is unknown',
      isRetryable: false,
      tries,
    });
  }
  const remote = params.remote;
  const record: ResultPublish = {
    ...held({ wanted, branch, sha, message: '', isRetryable: false, tries }),
    state: 'awaiting_confirm',
    message: null,
  };
  if (wanted.mode === 'push') {
    return { ...record, state: 'pushing' };
  }
  if (remote === null || remote.kind === 'unknown') {
    return held({
      wanted,
      branch,
      sha,
      message: 'the online copy was not read when the agent started, so a force push is not safe',
      isRetryable: false,
      tries,
    });
  }
  const startHead = snapshotOf({ baseline })?.head ?? null;
  if (startHead === null) {
    return held({
      wanted,
      branch,
      sha,
      message: 'the start of the work was not recorded, so no backup can be kept',
      isRetryable: false,
      tries,
    });
  }
  if (!wanted.isContentChanging) {
    const isSame = await isSameTree({ ports, worktreePath, base: startHead, head: sha });
    if (isSame === null) {
      return held({
        wanted,
        branch,
        sha,
        message: 'the files could not be compared with the start, so nothing was pushed',
        isRetryable: true,
        tries,
      });
    }
    if (!isSame) {
      return held({ wanted, branch, sha, message: CONTENT_CHANGED, isRetryable: false, tries });
    }
  }
  if (remote.kind === 'absent') {
    return { ...record, leaseSha: null, backupRef: null };
  }
  try {
    const backupRef = await ports.createBackup({ worktreePath, branch, sha: remote.sha });
    if (startHead !== remote.sha) {
      await ports.createBackup({ worktreePath, branch, sha: startHead });
    }
    return { ...record, leaseSha: remote.sha, backupRef };
  } catch (error) {
    return held({
      wanted,
      branch,
      sha,
      message: `a backup of the online copy could not be kept (${formatError(error)}), so nothing was pushed. Fetch the branch and try again`,
      isRetryable: true,
      tries,
    });
  }
};
