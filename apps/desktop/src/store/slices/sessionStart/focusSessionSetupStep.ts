import type { SessionSetupStepParams } from './skipSessionSetupStep';
import type { SetFn } from './types';

export const focusSessionSetupStep = (set: SetFn) => {
  return ({ sessionId, step }: SessionSetupStepParams): void => {
    set((state) => ({
      sessionSetupOpenStep: { ...state.sessionSetupOpenStep, [sessionId]: step },
      sessionSetupSkips: {
        ...state.sessionSetupSkips,
        [sessionId]: (state.sessionSetupSkips[sessionId] ?? []).filter(
          (skipped) => skipped !== step,
        ),
      },
    }));
  };
};
