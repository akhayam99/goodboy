import type { WorkSurfacePosition } from './types';

type Params = {
  readonly entries: ReadonlyArray<WorkSurfacePosition>;
  readonly current: WorkSurfacePosition;
};

export const amendTopPosition = ({
  entries,
  current,
}: Params): ReadonlyArray<WorkSurfacePosition> => {
  const top = entries[entries.length - 1];
  if (top == null || top.lens !== current.lens) {
    return entries;
  }
  return [...entries.slice(0, entries.length - 1), current];
};
