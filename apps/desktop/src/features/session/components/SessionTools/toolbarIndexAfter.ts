type Params = {
  readonly key: string;
  readonly from: number;
  readonly count: number;
};

export const toolbarIndexAfter = ({ key, from, count }: Params): number | null => {
  if (count === 0) {
    return null;
  }
  if (key === 'ArrowDown') {
    return (from + 1) % count;
  }
  if (key === 'ArrowUp') {
    return (from - 1 + count) % count;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return count - 1;
  }
  return null;
};
