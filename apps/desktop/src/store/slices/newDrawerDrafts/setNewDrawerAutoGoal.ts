import type { SessionId } from '@goodboy/types';
import type { SetFn } from '../../slice-types';

export type SetNewDrawerAutoGoalParams = {
  readonly sessionId: SessionId;
  readonly goal: string;
};

export const setNewDrawerAutoGoal = (set: SetFn) => {
  return ({ sessionId, goal }: SetNewDrawerAutoGoalParams): void => {
    set((state) => {
      const next = { ...state.newDrawerDrafts };
      if (goal === '') {
        delete next[sessionId];
        return { newDrawerDrafts: next };
      }
      next[sessionId] = { autoGoal: goal };
      return { newDrawerDrafts: next };
    });
  };
};
