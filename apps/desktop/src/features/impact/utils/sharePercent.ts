type Params = {
  readonly part: number;
  readonly total: number;
};

export const sharePercent = ({ part, total }: Params): number | null => {
  if (total <= 0) {
    return null;
  }
  return (part / total) * 100;
};
