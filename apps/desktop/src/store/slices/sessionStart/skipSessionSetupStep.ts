import type { SessionId } from '@goodboy/types';
import type { SessionSetupStep } from './state';
import type { SetFn } from './types';

export type SessionSetupStepParams = {
  readonly sessionId: SessionId;
  readonly step: SessionSetupStep;
};

export const skipSessionSetupStep = (set: SetFn) => {
  return ({ sessionId, step }: SessionSetupStepParams): void => {
    set((state) => {
      const skips = state.sessionSetupSkips[sessionId] ?? [];
      const sessionSetupOpenStep = { ...state.sessionSetupOpenStep };
      delete sessionSetupOpenStep[sessionId];
      return {
        sessionSetupSkips: {
          ...state.sessionSetupSkips,
          [sessionId]: skips.includes(step) ? skips : [...skips, step],
        },
        sessionSetupOpenStep,
      };
    });
  };
};
