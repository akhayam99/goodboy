type Params = {
  readonly branches: ReadonlyArray<string>;
};

export const taskPlacementLabel = ({ branches }: Params): string => {
  if (branches.length === 0) {
    return 'Not on a branch yet';
  }
  if (branches.length === 1) {
    return `On ${branches[0]}`;
  }
  return `On ${branches.length} branches`;
};
