type Params = {
  readonly count: number;
};

export const needsYouLabelOf = ({ count }: Params): string | null => {
  if (count <= 0) {
    return null;
  }
  return count === 1 ? '1 needs you' : `${count} need you`;
};
