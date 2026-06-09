import type { SetFn } from './types';

export const removeWindowPresence = (set: SetFn) => {
  return (label: string): void => {
    set((state) => {
      if (!(label in state.windowPresence)) return {};
      const next = { ...state.windowPresence };
      delete next[label];
      return { windowPresence: next };
    });
  };
};
