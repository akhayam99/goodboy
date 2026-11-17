type Params<T> = {
  readonly columns: ReadonlyArray<ReadonlyArray<T>>;
};

export const turnedDockColumnsOf = <T>({
  columns,
}: Params<T>): ReadonlyArray<ReadonlyArray<T>> | null => {
  const [left, right] = columns;
  if (columns.length === 2 && left?.length === 1 && right?.length === 1) {
    return [[...left, ...right]];
  }
  const [top, bottom] = left ?? [];
  if (columns.length === 1 && left?.length === 2 && top !== undefined && bottom !== undefined) {
    return [[top], [bottom]];
  }
  return null;
};
