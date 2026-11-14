import { pullRequestOfResult, type ResultPullRequest } from '@goodboy/core/auto';
import {
  getAutoDelegation,
  type AutoDelegation,
  type AutoGrant,
  type GuardedStatement,
  type PlainStatement,
} from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { AskAnswer, AskAnswerResult } from '../../../../features/auto/askAnswerPort';
import type { ScribePublication } from '../ports';
import { PUSH_LIVE_WINDOW_MS } from '../settledPush/PUSH_LIVE_WINDOW_MS';
import type { AgentVerbContext } from '../verbContext';
import { answerGrant } from './answerGrant';

const ABORT_RECORD = 'pull_request_record';

type Statement = GuardedStatement | PlainStatement;

type Params = {
  readonly ctx: AgentVerbContext;
  readonly grant: AutoGrant;
  readonly answer: AskAnswer;
};

type HeldParams = {
  readonly ctx: AgentVerbContext;
  readonly grant: AutoGrant;
};

type Held = Readonly<{ delegation: AutoDelegation; record: ResultPullRequest }>;

const heldOf = async ({ ctx, grant }: HeldParams): Promise<Held | null> => {
  if (grant.delegationId === null) {
    return null;
  }
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId: grant.delegationId });
  const record = delegation === null ? null : pullRequestOfResult({ result: delegation.result });
  if (
    delegation === null ||
    record === null ||
    delegation.state !== 'settled' ||
    record.grantId !== grant.id ||
    record.textVersion !== grant.textVersion
  ) {
    return null;
  }
  return { delegation, record };
};

type PatchParams = {
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
  readonly fromState: ResultPullRequest['state'];
  readonly staleBefore?: number;
};

const patchRecordStatement = ({
  delegation,
  record,
  fromState,
  staleBefore,
}: PatchParams): GuardedStatement => ({
  sql: `UPDATE auto_delegations
    SET result_json = json_set(result_json, '$.verified.pullRequest', json(?))
    WHERE id = ? AND generation = ? AND state = 'settled'
      AND json_extract(result_json, '$.verified.pullRequest.grantId') = ?
      AND json_extract(result_json, '$.verified.pullRequest.state') = ?${
        staleBefore === undefined
          ? ''
          : " AND coalesce(json_extract(result_json, '$.verified.pullRequest.startedAt'), 0) < ?"
      }`,
  params: [
    JSON.stringify(record),
    delegation.id,
    delegation.generation,
    record.grantId,
    fromState,
    ...(staleBefore === undefined ? [] : [staleBefore]),
  ],
  abortWhen: 'noChanges',
  abortCode: ABORT_RECORD,
});

type BumpParams = {
  readonly delegation: AutoDelegation;
  readonly nowMs: number;
};

const bumpTreeStatement = ({ delegation, nowMs }: BumpParams): PlainStatement => ({
  sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
  params: [nowMs, delegation.treeId],
});

type UsedParams = {
  readonly grant: AutoGrant;
  readonly nowMs: number;
};

const grantUsedStatement = ({ grant, nowMs }: UsedParams): PlainStatement => ({
  sql: `UPDATE auto_grants SET state = 'used', updated_at = ?
    WHERE id = ? AND state IN ('allowed', 'declined')`,
  params: [nowMs, grant.id],
});

type WriteParams = {
  readonly ctx: AgentVerbContext;
  readonly statements: ReadonlyArray<Statement>;
};

const isWritten = ({ ctx, statements }: WriteParams): Promise<boolean> =>
  ctx.db
    .transaction({ statements: [...statements] })
    .then((outcome) => outcome.status === 'committed')
    .catch((): boolean => false);

type ClaimParams = Held & {
  readonly ctx: AgentVerbContext;
};

const claimOf = async ({
  ctx,
  delegation,
  record,
}: ClaimParams): Promise<ResultPullRequest | null> => {
  const nowMs = ctx.now();
  const claimed: ResultPullRequest = {
    ...record,
    state: 'opening',
    message: null,
    startedAt: nowMs,
  };
  const claim = patchRecordStatement({
    delegation,
    record: claimed,
    fromState: record.state,
    ...(record.state === 'opening' && { staleBefore: nowMs - PUSH_LIVE_WINDOW_MS }),
  });
  const isClaimed = await isWritten({
    ctx,
    statements: [claim, bumpTreeStatement({ delegation, nowMs })],
  });
  return isClaimed ? claimed : null;
};

type OpenParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
};

const openHeld = async ({ ctx, delegation, record }: OpenParams): Promise<ScribePublication> => {
  const sessionId = delegation.target['sessionId'];
  if (typeof sessionId !== 'string') {
    return { kind: 'failed', message: 'The session of this pull request is unknown.' };
  }
  return ctx.ports
    .publishScribePullRequest({
      sessionId: brandId<SessionId>({ value: sessionId }),
      mountId: record.mountId,
      agentId: delegation.childAgentId,
      output: {
        prTitle: record.title,
        prBody: record.body,
        commitMessages: [],
        changelogEntry: null,
      },
    })
    .catch((error: unknown): ScribePublication => ({
      kind: 'failed',
      message: formatError(error),
    }));
};

type PublishParams = Held & {
  readonly ctx: AgentVerbContext;
  readonly grant: AutoGrant;
};

const publishHeld = async ({
  ctx,
  grant,
  delegation,
  record,
}: PublishParams): Promise<AskAnswerResult> => {
  const claimed = await claimOf({ ctx, delegation, record });
  if (claimed === null) {
    return 'settled';
  }
  const published = await openHeld({ ctx, delegation, record: claimed });
  const nowMs = ctx.now();
  const settled: ResultPullRequest =
    published.kind === 'opened'
      ? { ...claimed, state: 'opened', number: published.number, url: published.url }
      : { ...claimed, state: 'failed', message: published.message };
  await isWritten({
    ctx,
    statements: [
      patchRecordStatement({ delegation, record: settled, fromState: 'opening' }),
      ...(settled.state === 'opened' ? [grantUsedStatement({ grant, nowMs })] : []),
      bumpTreeStatement({ delegation, nowMs }),
    ],
  });
  return 'allowed';
};

type OpenAgainParams = {
  readonly record: ResultPullRequest;
};

const isOpenAgain = ({ record }: OpenAgainParams): boolean =>
  record.state === 'failed' || record.state === 'opening' || record.state === 'declined';

export const answerPullRequest = async ({
  ctx,
  grant,
  answer,
}: Params): Promise<AskAnswerResult> => {
  const held = await heldOf({ ctx, grant });
  if (held === null || !grant.isCurrent) {
    return 'settled';
  }
  if (grant.state !== 'asked') {
    const canOpenAgain =
      answer === 'allow' &&
      (grant.state === 'allowed' || grant.state === 'declined') &&
      isOpenAgain({ record: held.record });
    return canOpenAgain ? publishHeld({ ctx, grant, ...held }) : 'settled';
  }
  const answered = await answerGrant({ ctx, grantId: grant.id, answer });
  if (answered.result === 'settled') {
    return 'settled';
  }
  if (answered.result === 'declined') {
    await isWritten({
      ctx,
      statements: [
        patchRecordStatement({
          delegation: held.delegation,
          record: { ...held.record, state: 'declined' },
          fromState: 'awaiting_confirm',
        }),
        bumpTreeStatement({ delegation: held.delegation, nowMs: ctx.now() }),
      ],
    });
    return 'declined';
  }
  return publishHeld({ ctx, grant, ...held });
};
