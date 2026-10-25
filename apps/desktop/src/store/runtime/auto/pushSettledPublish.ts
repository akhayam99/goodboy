import { publishOfResult, type ResultPublish } from '@goodboy/core';
import {
  claimAutoAttemptPublishStatement,
  followAutoDelegationPublishStatement,
  getAutoAttempt,
  getAutoDelegation,
  settleAutoAttemptPublishStatement,
  type AutoAttempt,
} from '@goodboy/db';
import { brandId, type AutoAttemptId, type SessionId } from '@goodboy/types';
import { executePublish } from './executePublish';
import { publishQueue } from './publishQueue';
import type { AgentVerbContext } from './verbContext';

export type PushSettledPublishParams = Readonly<{
  ctx: AgentVerbContext;
  attemptId: AutoAttemptId;
}>;

export type PushSettledOutcome = 'pushed' | 'failed' | 'fenced' | 'interrupted' | 'none';

const ABORT_CLAIM = 'publish_claim';
const ABORT_SETTLE = 'publish_settle';
const FENCED =
  'Auto moved on or stopped before the push, so nothing was pushed. Try the push again';
const INTERRUPTED =
  'Goodboy closed while it was pushing. Try the push again to check the branch online';

type AttemptParams = {
  readonly attempt: AutoAttempt;
};

const pendingOf = ({ attempt }: AttemptParams): ResultPublish | null => {
  const snapshot = attempt.resultSnapshot;
  const envelope =
    typeof snapshot === 'object' && snapshot !== null && 'envelope' in snapshot
      ? snapshot.envelope
      : null;
  const record = publishOfResult({ result: envelope });
  return record?.state === 'pushing' ? record : null;
};

type WriteParams = {
  readonly ctx: AgentVerbContext;
  readonly attempt: AutoAttempt;
  readonly publish: ResultPublish;
  readonly isClaimed: boolean;
};

const writeSettled = async ({ ctx, attempt, publish, isClaimed }: WriteParams): Promise<void> => {
  await ctx.db.transaction({
    statements: [
      settleAutoAttemptPublishStatement({
        attemptId: attempt.id,
        generation: attempt.generation,
        publish,
        isClaimed,
        abortCode: ABORT_SETTLE,
      }),
      followAutoDelegationPublishStatement({
        delegationId: attempt.delegationId,
        generation: attempt.generation,
        publish,
      }),
    ],
  });
};

type RetryableParams = {
  readonly record: ResultPublish;
  readonly message: string;
};

const retryable = ({ record, message }: RetryableParams): ResultPublish => ({
  ...record,
  state: 'failed',
  message,
  isRetryable: true,
  isConfirmed: false,
});

type TaskParams = {
  readonly ctx: AgentVerbContext;
  readonly attemptId: AutoAttemptId;
  readonly sessionId: string;
  readonly mountId: string;
  readonly worktreePath: string;
};

const pushPending = async ({
  ctx,
  attemptId,
  sessionId,
  mountId,
  worktreePath,
}: TaskParams): Promise<PushSettledOutcome> => {
  const attempt = await getAutoAttempt({ db: ctx.db, attemptId });
  const record = attempt === null ? null : pendingOf({ attempt });
  if (attempt === null || record === null) {
    return 'none';
  }
  if (record.isConfirmed) {
    await writeSettled({
      ctx,
      attempt,
      publish: retryable({ record, message: INTERRUPTED }),
      isClaimed: true,
    });
    return 'interrupted';
  }
  const claimed = await ctx.db.transaction({
    statements: [
      claimAutoAttemptPublishStatement({
        attemptId: attempt.id,
        treeId: attempt.treeId,
        generation: attempt.generation,
        ownerId: ctx.scheduler.ownerId,
        nowMs: ctx.now(),
        abortCode: ABORT_CLAIM,
      }),
    ],
  });
  if (claimed.status !== 'committed') {
    await writeSettled({
      ctx,
      attempt,
      publish: retryable({ record, message: FENCED }),
      isClaimed: false,
    });
    return 'fenced';
  }
  const executed = await executePublish({
    ports: ctx.ports,
    sessionId: brandId<SessionId>({ value: sessionId }),
    mountId,
    worktreePath,
    record: { ...record, isConfirmed: true },
  });
  await writeSettled({ ctx, attempt, publish: executed, isClaimed: true });
  return executed.state === 'pushed' ? 'pushed' : 'failed';
};

export const pushSettledPublish = async ({
  ctx,
  attemptId,
}: PushSettledPublishParams): Promise<PushSettledOutcome> => {
  const attempt = await getAutoAttempt({ db: ctx.db, attemptId });
  const delegation =
    attempt === null
      ? null
      : await getAutoDelegation({ db: ctx.db, delegationId: attempt.delegationId });
  const sessionId = delegation?.target['sessionId'];
  const mountId = delegation?.target['mountId'];
  const worktreePath = delegation?.target['worktreePath'];
  if (
    typeof sessionId !== 'string' ||
    typeof mountId !== 'string' ||
    typeof worktreePath !== 'string'
  ) {
    return 'none';
  }
  return publishQueue.run({
    key: worktreePath,
    task: () => pushPending({ ctx, attemptId, sessionId, mountId, worktreePath }),
  });
};
