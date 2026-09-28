import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export type CloseSessionSetupStepParams = {
  readonly sessionId: SessionId;
};

export const closeSessionSetupStep = (set: SetFn) => {
  return ({ sessionId }: CloseSessionSetupStepParams): void => {
    set((state) => {
      if (state.sessionSetupOpenStep[sessionId] === undefined) {
        return {};
      }
      const sessionSetupOpenStep = { ...state.sessionSetupOpenStep };
      delete sessionSetupOpenStep[sessionId];
      return { sessionSetupOpenStep };
    });
  };
};
