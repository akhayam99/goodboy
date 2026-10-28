import { normalizeTouchPath } from './normalizeTouchPath';

type Params = Readonly<{
  first: ReadonlyArray<string> | undefined;
  second: ReadonlyArray<string> | undefined;
}>;

type PathPairParams = Readonly<{
  left: string;
  right: string;
}>;

const pathsOverlap = ({ left, right }: PathPairParams): boolean =>
  left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);

type TouchesParams = Readonly<{
  touches: ReadonlyArray<string>;
}>;

const normalizedOf = ({ touches }: TouchesParams): ReadonlyArray<string> =>
  touches.map((path) => normalizeTouchPath({ path }));

export const clusterTouchesOverlap = ({ first, second }: Params): boolean => {
  if (first === undefined || second === undefined) {
    return true;
  }
  const left = normalizedOf({ touches: first });
  const right = normalizedOf({ touches: second });
  if (left.length === 0 || right.length === 0) {
    return true;
  }
  if (left.includes('') || right.includes('')) {
    return true;
  }
  return left.some((path) => right.some((other) => pathsOverlap({ left: path, right: other })));
};
