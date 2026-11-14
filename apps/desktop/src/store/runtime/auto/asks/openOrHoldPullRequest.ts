import type { ResultPullRequest } from '@goodboy/core/auto';
import { insertAutoGrantStatement, type AutoDelegation, type AutoGrantId } from '@goodboy/db';
import { brandId } from '@goodboy/types';
import { readPublishPermissions } from '../level/readPublishPermissions';
import type { AgentVerbContext } from '../verbContext';
import { bumpTreeStatement } from './bumpTreeStatement';
import { heldForPushStatements } from './heldForPushStatements';
import { isStatementsWritten } from './isStatementsWritten';
import { publishHeldPullRequest } from './publishHeldPullRequest';
import { pullRequestPushGateOf } from './pullRequestPushGateOf';
import { pullRequestRecordStatement } from './pullRequestRecordStatement';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly record: ResultPullRequest;
};

const askFirst = async ({ ctx, delegation, record }: Params): Promise<boolean> => {
  const nowMs = ctx.now();
  const grantId = brandId<AutoGrantId>({ value: `grant-pr-held-${delegation.id}` });
  return isStatementsWritten({
    ctx,
    statements: [
      insertAutoGrantStatement({
        grant: {
          id: grantId,
          treeId: delegation.treeId,
          delegationId: delegation.id,
          attemptId: null,
          textVersion: record.textVersion,
          kind: 'pull_request',
          subject: record.mountId,
          nowMs,
        },
      }),
      pullRequestRecordStatement({
        delegation,
        record: { ...record, state: 'awaiting_confirm', grantId, message: null, startedAt: null },
        fromState: record.state,
      }),
      bumpTreeStatement({ delegation, nowMs }),
    ],
  });
};

export const openOrHoldPullRequest = async ({
  ctx,
  delegation,
  record,
}: Params): Promise<boolean> => {
  if (record.grantId === null) {
    const { pullRequest } = await readPublishPermissions({ db: ctx.db, treeId: delegation.treeId });
    if (pullRequest === 'ask') {
      return askFirst({ ctx, delegation, record });
    }
  }
  const gate = await pullRequestPushGateOf({ ctx, delegation });
  if (gate.kind === 'go') {
    return publishHeldPullRequest({ ctx, delegation, record, sha: gate.sha });
  }
  const nowMs = ctx.now();
  if (gate.kind === 'blocked') {
    return isStatementsWritten({
      ctx,
      statements: [
        pullRequestRecordStatement({
          delegation,
          record: { ...record, state: 'failed', message: gate.message, startedAt: null },
          fromState: record.state,
        }),
        bumpTreeStatement({ delegation, nowMs }),
      ],
    });
  }
  const statements = await heldForPushStatements({
    ctx,
    delegation,
    record,
    message: gate.message,
    raise: gate.raise,
  });
  return isStatementsWritten({
    ctx,
    statements: [...statements, bumpTreeStatement({ delegation, nowMs })],
  });
};
