const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
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
