import type { SetDeskToolStartParams, SetFn } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

export const setDeskToolStart = ({ set }: FactoryParams) => {
  return ({ sessionId, start }: SetDeskToolStartParams): void => {
    set((state) => {
      if (start !== null) {
        return { deskToolStart: { ...state.deskToolStart, [sessionId]: start } };
      }
      if (state.deskToolStart[sessionId] === undefined) {
        return state;
      }
      return {
        deskToolStart: Object.fromEntries(
          Object.entries(state.deskToolStart).filter(([id]) => id !== sessionId),
        ),
      };
    });
  };
};
