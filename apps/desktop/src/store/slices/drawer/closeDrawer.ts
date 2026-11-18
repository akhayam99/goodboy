import { closeSlotEntry } from './closeSlotEntry';
import type { SetFn } from './types';

export const closeDrawer = (set: SetFn) => {
  return (): void => {
    set((state) =>
      state.drawer === null ? state : closeSlotEntry({ state, entry: state.drawer }),
    );
  };
};
