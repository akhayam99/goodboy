import { deskStackOf } from '../drawer/deskStackOf';
import { faceSelections } from './faceSelections';
import type { SetFn, SetSessionFaceParams } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

export const setSessionFace = ({ set }: FactoryParams) => {
  return ({ sessionId, face }: SetSessionFaceParams): void => {
    faceSelections.bump({ sessionId });
    set((state) => {
      if ((state.sessionFace[sessionId] ?? 'overview') === face) {
        return state;
      }
      const sessionFace = { ...state.sessionFace, [sessionId]: face };
      const stack = deskStackOf({ top: state.drawer ?? null, back: state.drawerBack ?? null });
      return face !== 'desk' && stack !== null && stack.agent.sessionId === sessionId
        ? { sessionFace, drawerBack: null }
        : { sessionFace };
    });
  };
};
