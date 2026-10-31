export type TreeOrder = 'children-first' | 'parent-first';

type Params = {
  readonly key: string;
  readonly levels: ReadonlyArray<number>;
  readonly from: number;
  readonly order?: TreeOrder;
};

type StepParams = Omit<Params, 'key'>;

const parentIndexOf = ({ levels, from, order = 'children-first' }: StepParams): number | null => {
  const level = levels[from];
  if (level === undefined) {
    return null;
  }
  const step = order === 'children-first' ? 1 : -1;
  for (let index = from + step; index >= 0 && index < levels.length; index += step) {
    const candidate = levels[index];
    if (candidate !== undefined && candidate < level) {
      return index;
    }
  }
  return null;
};

const childIndexOf = ({ levels, from, order = 'children-first' }: StepParams): number | null => {
  const level = levels[from];
  const next = order === 'children-first' ? from - 1 : from + 1;
  const neighbour = levels[next];
  if (level === undefined || neighbour === undefined || neighbour <= level) {
    return null;
  }
  return next;
};

export const treeKeyTargetOf = ({
  key,
  levels,
  from,
  order = 'children-first',
}: Params): number | null => {
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
      return parentIndexOf({ levels, from, order });
    case 'ArrowRight':
      return childIndexOf({ levels, from, order });
    default:
      return null;
  }
};
