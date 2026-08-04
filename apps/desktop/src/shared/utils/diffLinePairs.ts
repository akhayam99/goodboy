import type { DiffHunkLine } from '@goodboy/types';

export type DiffLinePair = {
  readonly old: DiffHunkLine | null;
  readonly new: DiffHunkLine | null;
};

type Params = {
  readonly lines: ReadonlyArray<DiffHunkLine>;
};

type RunParams = {
  readonly lines: ReadonlyArray<DiffHunkLine>;
  readonly from: number;
  readonly kind: DiffHunkLine['kind'];
};

const takeRun = ({ lines, from, kind }: RunParams): ReadonlyArray<DiffHunkLine> => {
  const run: DiffHunkLine[] = [];
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index];
    if (line == null || line.kind !== kind) {
      return run;
    }
    run.push(line);
  }
  return run;
};

export const pairDiffLines = ({ lines }: Params): ReadonlyArray<DiffLinePair> => {
  const pairs: DiffLinePair[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line == null) {
      return pairs;
    }
    if (line.kind === 'context') {
      pairs.push({ old: line, new: line });
      index += 1;
      continue;
    }
    const removed = takeRun({ lines, from: index, kind: 'del' });
    const added = takeRun({ lines, from: index + removed.length, kind: 'add' });
    const height = Math.max(removed.length, added.length);
    for (let offset = 0; offset < height; offset += 1) {
      pairs.push({ old: removed[offset] ?? null, new: added[offset] ?? null });
    }
    index += removed.length + added.length;
  }
  return pairs;
};
