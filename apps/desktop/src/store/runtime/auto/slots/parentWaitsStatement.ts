import type { GuardedStatement, StatementGuard } from '@goodboy/db';

type Params = {
  readonly parentId: string;
  readonly questionId: string;
  readonly abortWhen: StatementGuard;
  readonly abortCode: string;
};

export const parentWaitsStatement = ({
  parentId,
  questionId,
  abortWhen,
  abortCode,
}: Params): GuardedStatement => ({
  sql: `SELECT 1 FROM auto_delegations parent
    WHERE parent.id = ? AND parent.state = 'paused'
      AND EXISTS (
        SELECT 1 FROM auto_attempts latest
        WHERE latest.delegation_id = parent.id AND latest.state = 'paused'
          AND latest.question_id = ?
          AND latest.ordinal = (SELECT MAX(ordinal) FROM auto_attempts WHERE delegation_id = parent.id)
      )`,
  params: [parentId, questionId],
  abortWhen,
  abortCode,
});
