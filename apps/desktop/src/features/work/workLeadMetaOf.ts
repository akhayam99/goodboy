import type { WorkRow } from './workRowsOf';

type Params = {
  readonly row: WorkRow;
  readonly projectName: string | null;
};

const branchTextOf = ({ branches }: Pick<WorkRow, 'branches'>): string => {
  const [only] = branches;
  if (only === undefined) {
    return 'no branch yet';
  }
  return branches.length === 1 ? only : `${branches.length} branches`;
};

export const workLeadMetaOf = ({ row, projectName }: Params): string =>
  [row.sessionGoal, projectName, branchTextOf({ branches: row.branches })]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
