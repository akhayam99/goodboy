type Params = {
  readonly pct: number;
  readonly prefix: 'bg' | 'text';
};

export const contextUsageTone = ({ pct, prefix }: Params): string => {
  if (pct >= 0.9) {
    return `${prefix}-danger`;
  }
  if (pct >= 0.75) {
    return `${prefix}-warning`;
  }
  if (pct >= 0.5) {
    return `${prefix}-info`;
  }
  return `${prefix}-success`;
};
