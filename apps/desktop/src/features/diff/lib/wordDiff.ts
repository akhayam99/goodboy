export type CharRange = {
  readonly start: number;
  readonly end: number;
};

export type ChangedRanges = {
  readonly old: CharRange;
  readonly new: CharRange;
};

const MIN_SHARED = 3;

export const changedRanges = (before: string, after: string): ChangedRanges | null => {
  if (before === after) {
    return null;
  }
  const limit = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < limit && before.charCodeAt(prefix) === after.charCodeAt(prefix)) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < limit - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  if (prefix + suffix < MIN_SHARED) {
    return null;
  }
  return {
    old: { start: prefix, end: before.length - suffix },
    new: { start: prefix, end: after.length - suffix },
  };
};
