type Params = {
  readonly key: string;
  readonly levels: ReadonlyArray<number>;
  readonly from: number;
};

type StepParams = Omit<Params, 'key'>;

const parentIndexOf = ({ levels, from }: StepParams): number | null => {
  const level = levels[from];
  if (level === undefined) {
    return null;
  }
  for (let index = from - 1; index >= 0; index -= 1) {
    const candidate = levels[index];
    if (candidate !== undefined && candidate < level) {
      return index;
    }
  }
  return null;
};

const childIndexOf = ({ levels, from }: StepParams): number | null => {
  const level = levels[from];
  const next = from + 1;
  const neighbour = levels[next];
  if (level === undefined || neighbour === undefined || neighbour <= level) {
    return null;
  }
  return next;
};

export const treeKeyTargetOf = ({ key, levels, from }: Params): number | null => {
  const last = levels.length - 1;
  if (last < 0) {
    return null;
  }
  switch (key) {
    case 'ArrowDown':
      return Math.min(from + 1, last);
    case 'ArrowUp':
      return Math.max(from - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'ArrowLeft':
      return parentIndexOf({ levels, from });
    case 'ArrowRight':
      return childIndexOf({ levels, from });
    default:
      return null;
  }
};
