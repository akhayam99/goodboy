const VERSION_PATTERN = /(\d{1,9}(?:\.\d{1,9}){1,5})/;

type ParseParams = {
  readonly raw: string | null;
};

export const parseCliVersion = ({ raw }: ParseParams): ReadonlyArray<number> | null => {
  if (raw === null) {
    return null;
  }
  const match = VERSION_PATTERN.exec(raw);
  const version = match?.[1];
  if (version === undefined) {
    return null;
  }
  return version.split('.').map((part) => Number.parseInt(part, 10));
};

type CompareParams = {
  readonly left: ReadonlyArray<number>;
  readonly right: ReadonlyArray<number>;
};

const compareParts = ({ left, right }: CompareParams): number => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const gap = (left[index] ?? 0) - (right[index] ?? 0);
    if (gap !== 0) {
      return gap;
    }
  }
  return 0;
};

type BelowParams = {
  readonly installed: string | null;
  readonly required: string | null;
};

export const isCliVersionBelow = ({ installed, required }: BelowParams): boolean => {
  const left = parseCliVersion({ raw: installed });
  const right = parseCliVersion({ raw: required });
  if (left === null || right === null) {
    return false;
  }
  return compareParts({ left, right }) < 0;
};

type NewestParams = {
  readonly versions: ReadonlyArray<string>;
};

export const newestCliVersion = ({ versions }: NewestParams): string | null => {
  let newest: string | null = null;
  for (const version of versions) {
    if (parseCliVersion({ raw: version }) === null) {
      continue;
    }
    if (newest === null || isCliVersionBelow({ installed: newest, required: version })) {
      newest = version;
    }
  }
  return newest;
};

type CleanParams = {
  readonly raw: string | null;
};

export const cleanCliVersion = ({ raw }: CleanParams): string | null => {
  const parts = parseCliVersion({ raw });
  return parts === null ? null : parts.join('.');
};
