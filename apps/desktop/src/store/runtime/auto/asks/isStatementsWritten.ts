import type { GuardedStatement, PlainStatement } from '@goodboy/db';
import type { AgentVerbContext } from '../verbContext';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly statements: ReadonlyArray<GuardedStatement | PlainStatement>;
};

export const isStatementsWritten = ({ ctx, statements }: Params): Promise<boolean> =>
  ctx.db
    .transaction({ statements: [...statements] })
    .then((outcome) => outcome.status === 'committed')
    .catch((): boolean => false);
