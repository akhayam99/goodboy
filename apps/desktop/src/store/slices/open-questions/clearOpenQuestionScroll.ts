import type { SetFn } from './types';

export const clearOpenQuestionScroll = (set: SetFn) => {
  return () => {
    set(() => ({ openQuestionScrollTarget: null }));
  };
};
