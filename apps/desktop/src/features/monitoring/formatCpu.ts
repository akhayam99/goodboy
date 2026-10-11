type Params = {
  readonly percent: number;
};

export const formatCpu = ({ percent }: Params): string => `${percent.toFixed(1)}%`;
