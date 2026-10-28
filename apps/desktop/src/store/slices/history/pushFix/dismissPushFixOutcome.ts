import { persistPushFixes } from './persistPushFixes';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixOutcome } from '../types';

type Params = {
  readonly mountId: PushFixOutcome['mountId'];
};

export const dismissPushFixOutcome = ({ set, get }: SliceDeps) => {
  return ({ mountId }: Params): void => {
    set((state) => ({
      pushFixOutcomes: Object.fromEntries(
        Object.entries(state.pushFixOutcomes).filter(([key]) => key !== mountId),
      ),
    }));
    persistPushFixes({ get });
  };
};
