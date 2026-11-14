import {
  AUTO_OWNER_GUARD_SQL,
  answerAutoGrantStatement,
  autoOwnerGuardParams,
  getAutoGrant,
  type AutoGrantId,
} from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import type { AskAnswer, AskAnswerResult } from '../../../../features/auto/askAnswerPort';
import type { AgentVerbContext } from '../verbContext';

const ABORT_TREE = 'grant_tree';
const ABORT_STATE = 'grant_state';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly grantId: AutoGrantId;
  readonly answer: AskAnswer;
};

export type AnswerGrantOutcome = Readonly<{
  result: AskAnswerResult;
  treeId: AutoTreeId | null;
}>;

const SETTLED: AnswerGrantOutcome = { result: 'settled', treeId: null };

export const answerGrant = async ({
  ctx,
  grantId,
  answer,
}: Params): Promise<AnswerGrantOutcome> => {
  const grant = await getAutoGrant({ db: ctx.db, grantId });
  if (grant === null || grant.state !== 'asked' || !grant.isCurrent) {
    return SETTLED;
  }
  const nowMs = ctx.now();
  const outcome = await ctx.db.transaction({
    statements: [
      {
        sql: `SELECT 1 FROM auto_trees
          WHERE id = ? AND stop_state = 'none' AND phase NOT IN ('stopping', 'stopped', 'finished')
            AND ${AUTO_OWNER_GUARD_SQL}`,
        params: [grant.treeId, ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs })],
        abortWhen: 'noRows',
        abortCode: ABORT_TREE,
      },
      answerAutoGrantStatement({
        grantId,
        answer: answer === 'allow' ? 'allowed' : 'declined',
        nowMs,
        abortCode: ABORT_STATE,
      }),
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, grant.treeId],
      },
    ],
  });
  if (outcome.status !== 'committed') {
    return SETTLED;
  }
  return { result: answer === 'allow' ? 'allowed' : 'declined', treeId: grant.treeId };
};
