import type { PickerCluster } from './terminalPickerClusters';

type CountParams = {
  readonly clusters: ReadonlyArray<PickerCluster>;
};

export const pickerRowCount = ({ clusters }: CountParams): number =>
  clusters.reduce((total, cluster) => total + cluster.rows.length, 0);
