import type { PlanId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  planId: PlanId;
}>;

export const planStartLock = {
  hold: ({ set, planId }: Params): void => {
    set((state) => ({
      planStarts: { ...state.planStarts, [planId]: (state.planStarts[planId] ?? 0) + 1 },
    }));
  },
  release: ({ set, planId }: Params): void => {
    set((state) => {
      const left = (state.planStarts[planId] ?? 0) - 1;
      if (left > 0) {
        return { planStarts: { ...state.planStarts, [planId]: left } };
      }
      if (!(planId in state.planStarts)) {
        return state;
      }
      const next = { ...state.planStarts };
      delete next[planId];
      return { planStarts: next };
    });
  },
};
