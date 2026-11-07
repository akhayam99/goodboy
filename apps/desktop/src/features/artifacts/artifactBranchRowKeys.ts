import type { ArtifactListRow } from './artifactListRows';

type RowKeyParams = {
  readonly groupKey: string;
  readonly rowId: string;
};

export const artifactBranchRowKeyOf = ({ groupKey, rowId }: RowKeyParams): string =>
  `${groupKey}/${rowId}`;

type SummaryParams = {
  readonly rows: ReadonlyArray<ArtifactListRow>;
  readonly fact: string | null;
};

export const artifactBranchSummaryOf = ({ rows, fact }: SummaryParams): string => {
  const needing = rows.filter((row) => row.group === 'needs').length;
  const used = rows.filter((row) => row.group === 'consumed').length;
  const open = rows.length - needing - used;
  return [
    fact,
    needing === 0 ? null : `${needing} ${needing === 1 ? 'needs' : 'need'} you`,
    open === 0 ? null : `${open} open`,
    used === 0 ? null : `${used} used`,
  ]
    .filter((part) => part !== null)
    .join(', ');
};

type GroupCountParams = {
  readonly rows: ReadonlyArray<ArtifactListRow>;
};

export const artifactBranchCountOf = ({ rows }: GroupCountParams): number =>
  rows.filter((row) => row.group !== 'deleted').length;
