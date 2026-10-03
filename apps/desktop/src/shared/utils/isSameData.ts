const MAX_DEPTH = 8;

const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

type SameParams = {
  readonly first: unknown;
  readonly second: unknown;
  readonly depth?: number;
};

export const isSameData = ({ first, second, depth = 0 }: SameParams): boolean => {
  if (Object.is(first, second)) {
    return true;
  }
  if (depth >= MAX_DEPTH) {
    return false;
  }
  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((value, index) =>
        isSameData({ first: value, second: second[index], depth: depth + 1 }),
      )
    );
  }
  if (!isPlainObject(first) || !isPlainObject(second)) {
    return false;
  }
  const keys = Object.keys(first);
  if (keys.length !== Object.keys(second).length) {
    return false;
  }
  return keys.every(
    (key) =>
      Object.hasOwn(second, key) &&
      isSameData({ first: first[key], second: second[key], depth: depth + 1 }),
  );
};
