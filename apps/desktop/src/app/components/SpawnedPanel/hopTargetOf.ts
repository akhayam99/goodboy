type Params = {
  readonly ids: ReadonlyArray<string>;
  readonly current: string | null;
  readonly direction: 'next' | 'previous';
};

export const hopTargetOf = ({ ids, current, direction }: Params): string | null => {
  if (ids.length === 0) {
    return null;
  }
  const index = current === null ? -1 : ids.indexOf(current);
  if (index < 0) {
    return (direction === 'next' ? ids[0] : ids[ids.length - 1]) ?? null;
  }
  const target = ids[direction === 'next' ? index + 1 : index - 1];
  return target ?? null;
};
