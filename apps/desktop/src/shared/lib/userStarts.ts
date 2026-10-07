const START_WINDOW_MS = 5_000;

type Marks = Map<string, number>;

type MarksParams = {
  readonly marks: Marks;
  readonly key: string;
};

const userStarts: Marks = new Map();

const isOpen = ({ marks, key }: MarksParams): boolean => {
  const expiresAt = marks.get(key);
  if (expiresAt === undefined) {
    return false;
  }
  if (expiresAt <= Date.now()) {
    marks.delete(key);
    return false;
  }
  return true;
};

const open = ({ marks, key }: MarksParams): void => {
  const now = Date.now();
  for (const [candidate, expiresAt] of marks) {
    if (expiresAt <= now) {
      marks.delete(candidate);
    }
  }
  marks.set(key, now + START_WINDOW_MS);
};

type KeyParams = {
  readonly key: string;
};

export const markUserStart = ({ key }: KeyParams): void => open({ marks: userStarts, key });

export const isUserStart = ({ key }: KeyParams): boolean => isOpen({ marks: userStarts, key });
