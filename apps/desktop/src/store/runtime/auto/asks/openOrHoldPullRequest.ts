import type { ResultPullRequest } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
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

export const openOrHoldPullRequest = async ({
  ctx,
  delegation,
  record,
}: Params): Promise<boolean> => {
  const gate = await pullRequestPushGateOf({ ctx, delegation });
  if (gate.kind === 'go') {
    return publishHeldPullRequest({ ctx, delegation, record });
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
