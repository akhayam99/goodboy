type Params = {
  readonly usedFraction: number;
};

export const formatUsedPercent = ({ usedFraction }: Params): string =>
  `${Math.round(Math.min(Math.max(usedFraction, 0), 1) * 100)}%`;
