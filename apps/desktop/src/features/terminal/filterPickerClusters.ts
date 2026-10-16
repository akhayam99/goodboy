import type { PickerCluster, PickerRow } from './terminalPickerClusters';

type FilterParams = {
  readonly clusters: ReadonlyArray<PickerCluster>;
  readonly query: string;
};

type HaystackParams = {
  readonly row: PickerRow;
  readonly cluster: PickerCluster;
};

const rowHaystack = ({ row, cluster }: HaystackParams): string =>
  `${row.projectName} ${row.branch ?? ''} ${cluster.title}`.toLowerCase();

export const filterPickerClusters = ({
  clusters,
  query,
}: FilterParams): ReadonlyArray<PickerCluster> => {
  const words = query
    .toLowerCase()
    .split(/\s+/u)
    .filter((word) => word !== '');
  if (words.length === 0) {
    return clusters;
  }
  return clusters
    .map((cluster) => ({
      ...cluster,
      rows: cluster.rows.filter((row) => {
        const haystack = rowHaystack({ row, cluster });
        return words.every((word) => haystack.includes(word));
      }),
    }))
    .filter((cluster) => cluster.rows.length > 0);
};
