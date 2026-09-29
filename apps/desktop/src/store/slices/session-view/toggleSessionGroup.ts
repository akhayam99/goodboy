import { isSessionGroupCollapsed } from './isSessionGroupCollapsed';
import type { SetFn } from './types';

type Params = {
  readonly key: string;
};

export const toggleSessionGroup = (set: SetFn) => {
  return ({ key }: Params): void => {
    set((s) => ({
      sessionGroupExpanded: {
        ...s.sessionGroupExpanded,
        [key]: isSessionGroupCollapsed({ key, overrides: s.sessionGroupExpanded }),
      },
    }));
  };
};
