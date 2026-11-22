import { faceSelections } from './faceSelections';
import type { SetFn, SetSessionFaceParams } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

export const setSessionFace = ({ set }: FactoryParams) => {
  return ({ sessionId, face }: SetSessionFaceParams): void => {
    faceSelections.bump({ sessionId });
    set((state) =>
      (state.sessionFace[sessionId] ?? 'overview') === face
        ? state
        : { sessionFace: { ...state.sessionFace, [sessionId]: face } },
    );
  };
};
