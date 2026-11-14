import type { ResultPullRequest } from '@goodboy/core/auto';
import {
  allowedAutoGrantGuard,
  type AutoDelegation,
  type AutoGrantId,
  type GuardedStatement,
  type PlainStatement,
} from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { ScribePublication } from '../ports';
import { PUSH_LIVE_WINDOW_MS } from '../settledPush/PUSH_LIVE_WINDOW_MS';
import type { AgentVerbContext } from '../verbContext';
import { bumpTreeStatement } from './bumpTreeStatement';
import { isStatementsWritten } from './isStatementsWritten';
import { pullRequestRecordStatement } from './pullRequestRecordStatement';

const NO_SESSION = 'The session of this pull request is unknown.';
const ABORT_GENERATION = 'pull_request_generation';
const ABORT_ALLOWANCE = 'pull_request_allowance';
const SAVE_TRIES = 3;

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
  readonly sha: string;
};

type ClaimParams = Omit<Params, 'sha'>;

type GenerationParams = {
  readonly delegation: AutoDelegation;
};

const currentGenerationGuard = ({ delegation }: GenerationParams): GuardedStatement => ({
  sql: `SELECT 1 FROM auto_delegations owner JOIN auto_trees tree ON tree.id = owner.tree_id
    WHERE owner.id = ? AND owner.generation = tree.generation`,
  params: [delegation.id],
  abortWhen: 'noRows',
  abortCode: ABORT_GENERATION,
});

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
  const isClaimed = await isStatementsWritten({
    ctx,
    statements: [
      currentGenerationGuard({ delegation }),
      ...(record.grantId === null
        ? []
        : [
            allowedAutoGrantGuard({
              grantId: brandId<AutoGrantId>({ value: record.grantId }),
              abortCode: ABORT_ALLOWANCE,
            }),
          ]),
      pullRequestRecordStatement({
        delegation,
        record: claimed,
        fromState: record.state,
        ...(record.state === 'opening' && { staleBefore: nowMs - PUSH_LIVE_WINDOW_MS }),
      }),
      bumpTreeStatement({ delegation, nowMs }),
    ],
  });
  return isClaimed ? claimed : null;
};

const openHeld = async ({ ctx, delegation, record, sha }: Params): Promise<ScribePublication> => {
  const sessionId = delegation.target['sessionId'];
  if (typeof sessionId !== 'string') {
    return { kind: 'failed', message: NO_SESSION };
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
      sha,
    })
    .catch((error: unknown): ScribePublication => ({
      kind: 'failed',
      message: formatError(error),
    }));
};

type UsedParams = {
  readonly grantId: string;
  readonly nowMs: number;
};

const grantUsedStatement = ({ grantId, nowMs }: UsedParams): PlainStatement => ({
  sql: `UPDATE auto_grants SET state = 'used', updated_at = ?
    WHERE id = ? AND state IN ('allowed', 'declined')`,
  params: [nowMs, grantId],
});

type SettleParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly settled: ResultPullRequest;
};

const isSettledSaved = async ({ ctx, delegation, settled }: SettleParams): Promise<boolean> => {
  for (let tries = 0; tries < SAVE_TRIES; tries += 1) {
    const nowMs = ctx.now();
    const isSaved = await isStatementsWritten({
      ctx,
      statements: [
        pullRequestRecordStatement({ delegation, record: settled, fromState: 'opening' }),
        ...(settled.state === 'opened' && settled.grantId !== null
          ? [grantUsedStatement({ grantId: settled.grantId, nowMs })]
          : []),
        bumpTreeStatement({ delegation, nowMs }),
      ],
    });
    if (isSaved) {
      return true;
    }
  }
  return false;
};

type UnsavedParams = {
  readonly published: ScribePublication;
};

const unsavedMessageOf = ({ published }: UnsavedParams): string =>
  published.kind === 'opened'
    ? `Pull request #${published.number} is open at ${published.url}, but Goodboy could not save that, so Auto still shows it as opening.`
    : `The pull request was not opened (${published.message}), and Goodboy could not save that, so Auto still shows it as opening.`;

export const publishHeldPullRequest = async ({
  ctx,
  delegation,
  record,
  sha,
}: Params): Promise<boolean> => {
  const claimed = await claimOf({ ctx, delegation, record });
  if (claimed === null) {
    return false;
  }
  const published = await openHeld({ ctx, delegation, record: claimed, sha });
  const settled: ResultPullRequest =
    published.kind === 'opened'
      ? { ...claimed, state: 'opened', number: published.number, url: published.url }
      : { ...claimed, state: 'failed', message: published.message };
  if (!(await isSettledSaved({ ctx, delegation, settled }))) {
    throw new Error(unsavedMessageOf({ published }));
  }
  return true;
};
