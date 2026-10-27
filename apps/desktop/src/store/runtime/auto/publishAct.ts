import {
  canPutBackPublish,
  canRetryPublish,
  checksRunOfResult,
  publishOfRequest,
  publishOfResult,
  type RemoteRead,
  type ResultPublish,
} from '@goodboy/core';
import {
  getAutoDelegation,
  listAutoAttemptsOfDelegation,
  patchAutoAttemptPublishStatement,
  patchAutoDelegationPublishStatement,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type AutoDelegationId, type SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type {
  PublishAct,
  PublishResult,
  PublishRowResult,
} from '../../../features/auto/publishPort';
import { remoteOf } from './attemptBaseline';
import { delegationRoleOf } from './attemptEnvelope';
import { executePublish } from './executePublish';
import { planPublish } from './planPublish';
import type { PushBranchOutcome, RestoreBackupOutcome } from './ports';
import { publishQueue } from './publishQueue';
import { readSnapshot } from './readSnapshot';
import type { AgentVerbContext } from './verbContext';
import { isRecord } from '@goodboy/types/helpers';

export type PublishActParams = Readonly<{
  ctx: AgentVerbContext;
  act: PublishAct;
  delegationIds: ReadonlyArray<AutoDelegationId>;
}>;

const ABORT_FENCE_DELEGATION = 'fence_delegation';
const ABORT_FENCE_ATTEMPT = 'fence_attempt';

const GONE = 'This result is no longer here, so there is nothing to push.';
const NOTHING_TO_ACT_ON = 'This agent has no push to act on.';
const NOT_WAITING = 'This push is not waiting for an answer.';
const CANNOT_RETRY = 'This push cannot be tried again.';
const CANNOT_PUT_BACK = 'This push cannot be put back.';
const BRANCH_MOVED_SINCE_PUSH = 'it moved after the push.';
const NOT_READABLE = 'it could not be read.';
const NOTHING_CHANGED = 'Nothing was put back, online or here:';
const LOCAL_LEFT = 'The local branch was left as it is:';
const NOT_SAVED = 'The push was not saved on the card because the result moved on.';

type RefusedParams = {
  readonly delegationId: AutoDelegationId;
  readonly message: string;
};

const refused = ({ delegationId, message }: RefusedParams): PublishRowResult => ({
  delegationId,
  state: 'refused',
  message,
});

type WriteParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly record: ResultPublish;
};

const writeRecord = async ({ ctx, delegation, record }: WriteParams): Promise<PublishRowResult> => {
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  const latest = attempts.filter((attempt) => attempt.state === 'ended').at(-1);
  const written = await ctx.db.transaction({
    statements: [
      patchAutoDelegationPublishStatement({
        delegationId: delegation.id,
        generation: delegation.generation,
        publish: record,
        abortCode: ABORT_FENCE_DELEGATION,
      }),
      ...(latest === undefined
        ? []
        : [
            patchAutoAttemptPublishStatement({
              attemptId: latest.id,
              generation: latest.generation,
              publish: record,
              abortCode: ABORT_FENCE_ATTEMPT,
            }),
          ]),
    ],
  });
  if (written.status !== 'committed') {
    return refused({ delegationId: delegation.id, message: NOT_SAVED });
  }
  return { delegationId: delegation.id, state: record.state, message: record.message };
};

type RowParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly sessionId: SessionId;
  readonly mountId: string;
  readonly worktreePath: string;
  readonly record: ResultPublish;
};

const confirmRow = async ({
  ctx,
  delegation,
  sessionId,
  mountId,
  worktreePath,
  record,
}: RowParams): Promise<PublishRowResult> => {
  if (record.state !== 'awaiting_confirm') {
    return refused({ delegationId: delegation.id, message: NOT_WAITING });
  }
  const executed = await executePublish({
    ports: ctx.ports,
    sessionId,
    mountId,
    worktreePath,
    record,
  });
  return writeRecord({ ctx, delegation, record: executed });
};

const declineRow = async ({ ctx, delegation, record }: RowParams): Promise<PublishRowResult> => {
  if (record.state !== 'awaiting_confirm') {
    return refused({ delegationId: delegation.id, message: NOT_WAITING });
  }
  return writeRecord({
    ctx,
    delegation,
    record: { ...record, state: 'declined', message: null, isRetryable: false },
  });
};

type EndingParams = {
  readonly result: unknown;
};

type Ending = Readonly<{ exit: string; completion: string }>;

const endingOf = ({ result }: EndingParams): Ending => {
  const process = isRecord(result) && isRecord(result['process']) ? result['process'] : {};
  const declared = isRecord(result) && isRecord(result['declared']) ? result['declared'] : {};
  const exit = process['exit'];
  const completion = declared['completion'];
  return {
    exit: typeof exit === 'string' ? exit : 'error',
    completion: typeof completion === 'string' ? completion : 'none',
  };
};

type RemoteNowParams = {
  readonly ports: AgentVerbContext['ports'];
  readonly worktreePath: string;
  readonly branch: string | null;
};

const remoteNowOf = async ({
  ports,
  worktreePath,
  branch,
}: RemoteNowParams): Promise<RemoteRead | null> => {
  if (branch === null) {
    return null;
  }
  try {
    return await ports.readRemoteHead({ worktreePath, branch });
  } catch {
    return { kind: 'unknown' };
  }
};

const retryRow = async (params: RowParams): Promise<PublishRowResult> => {
  const { ctx, delegation, sessionId, mountId, worktreePath, record } = params;
  const wanted = publishOfRequest({ request: delegation.request });
  if (!canRetryPublish({ publish: record }) || wanted === null) {
    return refused({ delegationId: delegation.id, message: CANNOT_RETRY });
  }
  if (record.isConfirmed && record.mode === 'push') {
    const executed = await executePublish({
      ports: ctx.ports,
      sessionId,
      mountId,
      worktreePath,
      record,
    });
    return writeRecord({ ctx, delegation, record: executed });
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  const baseline = attempts.filter((attempt) => attempt.state === 'ended').at(-1)?.baseline;
  const ending = endingOf({ result: delegation.result });
  const remote =
    record.mode === 'force'
      ? await remoteNowOf({ ports: ctx.ports, worktreePath, branch: record.branch })
      : remoteOf({ baseline });
  const planned = await planPublish({
    ports: ctx.ports,
    worktreePath,
    branch: record.branch,
    wanted,
    baseline,
    remote,
    outcome: delegation.outcome ?? 'failed',
    exit: ending.exit,
    completion: ending.completion,
    checksRun: checksRunOfResult({ result: delegation.result }),
    endHead: record.sha,
    tries: record.tries + 1,
  });
  if (planned.state !== 'pushing') {
    return writeRecord({ ctx, delegation, record: planned });
  }
  const executed = await executePublish({
    ports: ctx.ports,
    sessionId,
    mountId,
    worktreePath,
    record: { ...planned, isConfirmed: true },
  });
  return writeRecord({ ctx, delegation, record: executed });
};

type OnlineParams = {
  readonly ports: AgentVerbContext['ports'];
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

type RestoreLocalParams = {
  readonly ctx: AgentVerbContext;
  readonly worktreePath: string;
  readonly branch: string;
  readonly sha: string;
  readonly backupRef: string;
};

const restoreLocal = async ({
  ctx,
  worktreePath,
  branch,
  sha,
  backupRef,
}: RestoreLocalParams): Promise<RestoreBackupOutcome> => {
  const head = await readSnapshot({ ports: ctx.ports, worktreePath });
  if (head === null) {
    return { kind: 'blocked', message: NOT_READABLE };
  }
  if (head.head !== sha) {
    return { kind: 'blocked', message: BRANCH_MOVED_SINCE_PUSH };
  }
  return ctx.ports
    .restoreBackup({ worktreePath, branch, expectedHead: sha, backupRef })
    .catch((error: unknown): RestoreBackupOutcome => ({
      kind: 'blocked',
      message: formatError(error),
    }));
};

const putBackRow = async ({
  ctx,
  delegation,
  sessionId,
  mountId,
  worktreePath,
  record,
}: RowParams): Promise<PublishRowResult> => {
  const { branch, sha, backupRef, leaseSha } = record;
  if (
    !canPutBackPublish({ publish: record }) ||
    branch === null ||
    sha === null ||
    backupRef === null ||
    leaseSha === null
  ) {
    return refused({ delegationId: delegation.id, message: CANNOT_PUT_BACK });
  }
  const pushed = await ctx.ports
    .pushBranch({
      sessionId,
      mountId,
      worktreePath,
      branch,
      sha: leaseSha,
      leaseSha: sha,
      isForce: true,
    })
    .catch((error: unknown): PushBranchOutcome => ({
      kind: 'failed',
      message: formatError(error),
    }));
  if (
    pushed.kind !== 'pushed' &&
    (pushed.kind === 'stale' ||
      (await onlineShaOf({ ports: ctx.ports, worktreePath, branch })) !== leaseSha)
  ) {
    return refused({
      delegationId: delegation.id,
      message: `${NOTHING_CHANGED} ${pushed.message}`,
    });
  }
  const local = await restoreLocal({ ctx, worktreePath, branch, sha, backupRef });
  return writeRecord({
    ctx,
    delegation,
    record: {
      ...record,
      state: 'put_back',
      message: local.kind === 'restored' ? null : `${LOCAL_LEFT} ${local.message}`,
      isRetryable: false,
    },
  });
};

const ROW_ACTS: Readonly<Record<PublishAct, (params: RowParams) => Promise<PublishRowResult>>> = {
  confirm: confirmRow,
  decline: declineRow,
  retry: retryRow,
  put_back: putBackRow,
};

type OneParams = {
  readonly ctx: AgentVerbContext;
  readonly act: PublishAct;
  readonly delegationId: AutoDelegationId;
};

const actOnOne = async ({ ctx, act, delegationId }: OneParams): Promise<PublishRowResult> => {
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId });
  if (delegation === null || delegation.state !== 'settled') {
    return refused({ delegationId, message: GONE });
  }
  const record = publishOfResult({ result: delegation.result });
  const mountId = delegation.target['mountId'];
  const worktreePath = delegation.target['worktreePath'];
  const sessionId = delegation.target['sessionId'];
  if (
    record === null ||
    typeof mountId !== 'string' ||
    typeof worktreePath !== 'string' ||
    typeof sessionId !== 'string' ||
    delegationRoleOf({ delegation }) === 'scribe'
  ) {
    return refused({ delegationId, message: NOTHING_TO_ACT_ON });
  }
  return publishQueue.run({
    key: worktreePath,
    task: async () => {
      const fresh = await getAutoDelegation({ db: ctx.db, delegationId });
      const current = fresh === null ? null : publishOfResult({ result: fresh.result });
      if (fresh === null || current === null) {
        return refused({ delegationId, message: GONE });
      }
      return ROW_ACTS[act]({
        ctx,
        delegation: fresh,
        sessionId: brandId<SessionId>({ value: sessionId }),
        mountId,
        worktreePath,
        record: current,
      });
    },
  });
};

export const publishAct = async ({
  ctx,
  act,
  delegationIds,
}: PublishActParams): Promise<PublishResult> => {
  const rows: PublishRowResult[] = [];
  for (const delegationId of delegationIds) {
    rows.push(await actOnOne({ ctx, act, delegationId }));
  }
  return { kind: 'done', rows };
};
