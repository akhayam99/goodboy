import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly fingerprints: ReadonlySet<string>;
};

type FactoryParams = {
  readonly set: SetFn;
};

type SameSetParams = {
  readonly first: ReadonlySet<string>;
  readonly second: ReadonlySet<string>;
};

const isSameSet = ({ first, second }: SameSetParams): boolean =>
  first.size === second.size && [...first].every((value) => second.has(value));

export const setSessionDismissedNextSteps = ({ set }: FactoryParams) => {
  return ({ sessionId, fingerprints }: Params): void => {
    set((state) => {
      const current = state.sessionDismissedNextSteps[sessionId];
      if (current !== undefined && isSameSet({ first: current, second: fingerprints })) {
        return state;
      }
      return {
        sessionDismissedNextSteps: {
          ...state.sessionDismissedNextSteps,
          [sessionId]: fingerprints,
        },
      };
    });
  };
};
