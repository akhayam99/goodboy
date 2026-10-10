import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const setExploreMountPath = (set: SetFn) => {
  return ({ sessionId, mountPath }: Params): void => {
    set((state) => {
      if ((state.exploreMountPath[sessionId] ?? null) === mountPath) {
        return state;
      }
      return { exploreMountPath: { ...state.exploreMountPath, [sessionId]: mountPath } };
    });
  };
};
