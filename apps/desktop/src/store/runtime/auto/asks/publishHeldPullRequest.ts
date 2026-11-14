import type { ResultPullRequest } from '@goodboy/core/auto';
import type { AutoDelegation, PlainStatement } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { ScribePublication } from '../ports';
import { PUSH_LIVE_WINDOW_MS } from '../settledPush/PUSH_LIVE_WINDOW_MS';
import type { AgentVerbContext } from '../verbContext';
import { bumpTreeStatement } from './bumpTreeStatement';
import { isStatementsWritten } from './isStatementsWritten';
import { pullRequestRecordStatement } from './pullRequestRecordStatement';

const NO_SESSION = 'The session of this pull request is unknown.';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
};

const claimOf = async ({ ctx, delegation, record }: Params): Promise<ResultPullRequest | null> => {
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

const openHeld = async ({ ctx, delegation, record }: Params): Promise<ScribePublication> => {
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

export const publishHeldPullRequest = async ({
  ctx,
  delegation,
  record,
}: Params): Promise<boolean> => {
  const claimed = await claimOf({ ctx, delegation, record });
  if (claimed === null) {
    return false;
  }
  const published = await openHeld({ ctx, delegation, record: claimed });
  const nowMs = ctx.now();
  const settled: ResultPullRequest =
    published.kind === 'opened'
      ? { ...claimed, state: 'opened', number: published.number, url: published.url }
      : { ...claimed, state: 'failed', message: published.message };
  await isStatementsWritten({
    ctx,
    statements: [
      pullRequestRecordStatement({ delegation, record: settled, fromState: 'opening' }),
      ...(settled.state === 'opened' && settled.grantId !== null
        ? [grantUsedStatement({ grantId: settled.grantId, nowMs })]
        : []),
      bumpTreeStatement({ delegation, nowMs }),
    ],
  });
  return true;
};
