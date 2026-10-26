type Params = {
  readonly count: number;
};

export const foldersWithOwnLabel = ({ count }: Params): string | null => {
  if (count <= 0) {
    return null;
  }
  return count === 1 ? '1 folder uses its own' : `${count} folders use their own`;
};
