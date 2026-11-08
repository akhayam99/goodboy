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

type NeedsParams = {
  readonly rows: ReadonlyArray<ArtifactListRow>;
};

export const artifactNeedsYouRowsOf = ({ rows }: NeedsParams): ReadonlyArray<ArtifactListRow> =>
  rows.filter((row) => row.group === 'needs');

export const artifactBranchNeedsYouOf = ({ rows }: NeedsParams): number =>
  artifactNeedsYouRowsOf({ rows }).length;

export const artifactBranchSummaryOf = ({ rows, fact }: SummaryParams): string => {
  const needing = artifactBranchNeedsYouOf({ rows });
  return [fact, needing === 0 ? null : `${needing} ${needing === 1 ? 'needs' : 'need'} you`]
    .filter((part) => part !== null)
    .join(', ');
};

type GroupCountParams = {
  readonly rows: ReadonlyArray<ArtifactListRow>;
};

export const artifactBranchCountOf = ({ rows }: GroupCountParams): number =>
  rows.filter((row) => row.group !== 'deleted').length;
