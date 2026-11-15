import { launchGuardOf, type LaunchAllowance, type LaunchGuardRows } from '@goodboy/core/auto';
import {
  listAutoGrantAllowances,
  markAutoGrantUsedStatement,
  type AutoDelegation,
  type AutoJsonObject,
  type Database,
  type Statement,
} from '@goodboy/db';

const ABORT_START_ALLOWANCE = 'start_allowance';

type Params = {
  readonly db: Database;
  readonly nowMs: number;
  readonly delegation: AutoDelegation;
  readonly writeSet: AutoJsonObject | null;
  readonly rows: LaunchGuardRows | null;
};

export type LaunchGuardStart = Readonly<{
  writeSet: AutoJsonObject | null;
  statements: ReadonlyArray<Statement>;
}>;

export const launchGuardStart = async ({
  db,
  nowMs,
  delegation,
  writeSet,
  rows,
}: Params): Promise<LaunchGuardStart> => {
  if (rows === null || writeSet === null) {
    return { writeSet, statements: [] };
  }
  const grants =
    delegation.retryOf === null
      ? []
      : await listAutoGrantAllowances({ db, delegationId: delegation.retryOf });
  const allowances = grants.flatMap((grant): ReadonlyArray<LaunchAllowance> =>
    grant.kind === 'pull_request' ? [] : [{ kind: grant.kind, subject: grant.subject }],
  );
  const used = grants.filter((grant) => grant.kind !== 'pull_request');
  const guard = launchGuardOf({ rows, allowances });
  return {
    writeSet: guard === null ? writeSet : { ...writeSet, guard },
    statements: used.map((grant) =>
      markAutoGrantUsedStatement({ grantId: grant.id, nowMs, abortCode: ABORT_START_ALLOWANCE }),
    ),
  };
};
