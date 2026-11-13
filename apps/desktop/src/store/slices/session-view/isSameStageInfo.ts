import type { SessionStageInfo } from '@goodboy/types';

type ValueParams = {
  readonly first: unknown;
  readonly second: unknown;
};

const isSameValue = ({ first, second }: ValueParams): boolean => {
  if (Object.is(first, second)) {
    return true;
  }
  if (!Array.isArray(first) || !Array.isArray(second)) {
    return false;
  }
  return (
    first.length === second.length &&
    first.every((item: unknown, index) => Object.is(item, second[index]))
  );
};

type Params = {
  readonly first: SessionStageInfo;
  readonly second: SessionStageInfo;
};

export const isSameStageInfo = ({ first, second }: Params): boolean => {
  const keys = Object.keys(first);
  return (
    keys.length === Object.keys(second).length &&
    keys.every((key) =>
      isSameValue({ first: Reflect.get(first, key), second: Reflect.get(second, key) }),
    )
  );
};
