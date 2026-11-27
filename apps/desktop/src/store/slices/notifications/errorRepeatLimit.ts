const REPEAT_WINDOW_MS = 60_000;

const suppressedByKey = new Map<string, number>();

type KeyParams = {
  readonly key: string;
};

const reportSuppressed = ({ key }: KeyParams): void => {
  const suppressed = suppressedByKey.get(key) ?? 0;
  suppressedByKey.delete(key);
  if (suppressed > 0) {
    console.warn(`[notifications] suppressed ${suppressed} repeats of ${key}`);
  }
};

export const isErrorRepeatAllowed = ({ key }: KeyParams): boolean => {
  const suppressed = suppressedByKey.get(key);
  if (suppressed === undefined) {
    suppressedByKey.set(key, 0);
    setTimeout(() => {
      reportSuppressed({ key });
    }, REPEAT_WINDOW_MS);
    return true;
  }
  suppressedByKey.set(key, suppressed + 1);
  return false;
};
