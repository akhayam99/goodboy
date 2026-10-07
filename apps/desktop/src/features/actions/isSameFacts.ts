const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const isSameEntries = (
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean => {
  const entries = Object.entries(a);
  return (
    entries.length === Object.keys(b).length &&
    entries.every(([key, value]) => Object.is(value, Reflect.get(b, key)))
  );
};

const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    return isSameEntries(a, b);
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((item, index) => Object.is(item, b[index]));
};

export const isSameFacts = ({
  previous,
  next,
}: {
  readonly previous: object | null;
  readonly next: object | null;
}): boolean => {
  if (previous === null || next === null) {
    return previous === next;
  }
  const previousEntries = Object.entries(previous);
  if (previousEntries.length !== Object.keys(next).length) {
    return false;
  }
  return previousEntries.every(([key, value]) => isSameValue(value, Reflect.get(next, key)));
};
