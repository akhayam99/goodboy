import { normalizeTouchPath } from './normalizeTouchPath';

type Params = Readonly<{
  first: ReadonlyArray<string> | undefined;
  second: ReadonlyArray<string> | undefined;
}>;

type TouchesParams = Readonly<{
  touches: ReadonlyArray<string> | undefined;
}>;

const cleanOf = ({ touches }: TouchesParams): ReadonlyArray<string> =>
  (touches ?? []).map((path) => normalizeTouchPath({ path })).filter((path) => path.length > 0);

export const sharedPathsOfPair = ({ first, second }: Params): ReadonlyArray<string> => {
  const found = new Set<string>();
  for (const left of cleanOf({ touches: first })) {
    for (const right of cleanOf({ touches: second })) {
      if (left === right) {
        found.add(left);
        continue;
      }
      if (left.startsWith(`${right}/`)) {
        found.add(left);
        continue;
      }
      if (right.startsWith(`${left}/`)) {
        found.add(right);
      }
    }
  }
  return Array.from(found);
};
