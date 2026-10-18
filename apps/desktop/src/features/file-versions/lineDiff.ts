export type LineEdit = Readonly<{
  kind: 'same' | 'add' | 'del';
  oldIndex: number | null;
  newIndex: number | null;
}>;

type Params = Readonly<{
  before: ReadonlyArray<string>;
  after: ReadonlyArray<string>;
  maxEdits?: number;
}>;

type RangeParams = Readonly<{
  before: ReadonlyArray<string>;
  after: ReadonlyArray<string>;
  start: number;
  oldEnd: number;
  newEnd: number;
  maxEdits: number;
}>;

const DEFAULT_MAX_EDITS = 1_000;

type SameParams = Readonly<{ oldIndex: number; newIndex: number }>;

type AddedParams = Readonly<{ newIndex: number }>;

type RemovedParams = Readonly<{ oldIndex: number }>;

const same = ({ oldIndex, newIndex }: SameParams): LineEdit => ({
  kind: 'same',
  oldIndex,
  newIndex,
});

const added = ({ newIndex }: AddedParams): LineEdit => ({ kind: 'add', oldIndex: null, newIndex });

const removed = ({ oldIndex }: RemovedParams): LineEdit => ({
  kind: 'del',
  oldIndex,
  newIndex: null,
});

const replaceAll = ({ start, oldEnd, newEnd }: RangeParams): ReadonlyArray<LineEdit> => [
  ...Array.from({ length: oldEnd - start }, (_, index) => removed({ oldIndex: start + index })),
  ...Array.from({ length: newEnd - start }, (_, index) => added({ newIndex: start + index })),
];

const middleEdits = ({
  before,
  after,
  start,
  oldEnd,
  newEnd,
  maxEdits,
}: RangeParams): ReadonlyArray<LineEdit> | null => {
  const n = oldEnd - start;
  const m = newEnd - start;
  const limit = Math.min(n + m, maxEdits);
  const offset = limit + 1;
  let frontier: Int32Array = new Int32Array(2 * limit + 3);
  const trace: Array<Int32Array> = [];
  let found = -1;
  for (let d = 0; d <= limit && found < 0; d += 1) {
    trace.push(frontier.slice());
    for (let k = -d; k <= d; k += 2) {
      const isDown =
        k === -d || (k !== d && (frontier[k - 1 + offset] ?? 0) < (frontier[k + 1 + offset] ?? 0));
      let x = isDown ? (frontier[k + 1 + offset] ?? 0) : (frontier[k - 1 + offset] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && before[start + x] === after[start + y]) {
        x += 1;
        y += 1;
      }
      frontier[k + offset] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found < 0) {
    return null;
  }
  const edits: Array<LineEdit> = [];
  let x = n;
  let y = m;
  for (let d = found; d >= 0; d -= 1) {
    frontier = trace[d] ?? frontier;
    const k = x - y;
    const isDown =
      k === -d || (k !== d && (frontier[k - 1 + offset] ?? 0) < (frontier[k + 1 + offset] ?? 0));
    const previousK = isDown ? k + 1 : k - 1;
    const previousX = frontier[previousK + offset] ?? 0;
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      edits.push(same({ oldIndex: start + x, newIndex: start + y }));
    }
    if (d === 0) {
      break;
    }
    edits.push(
      x === previousX
        ? added({ newIndex: start + previousY })
        : removed({ oldIndex: start + previousX }),
    );
    x = previousX;
    y = previousY;
  }
  return edits.reverse();
};

export const lineDiff = ({
  before,
  after,
  maxEdits = DEFAULT_MAX_EDITS,
}: Params): ReadonlyArray<LineEdit> => {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const range: RangeParams = {
    before,
    after,
    start: prefix,
    oldEnd: before.length - suffix,
    newEnd: after.length - suffix,
    maxEdits,
  };
  const delta = before.length - after.length;
  const head = Array.from({ length: prefix }, (_, index) =>
    same({ oldIndex: index, newIndex: index }),
  );
  const tail = Array.from({ length: suffix }, (_, index) =>
    same({ oldIndex: range.oldEnd + index, newIndex: range.oldEnd - delta + index }),
  );
  return [...head, ...(middleEdits(range) ?? replaceAll(range)), ...tail];
};
