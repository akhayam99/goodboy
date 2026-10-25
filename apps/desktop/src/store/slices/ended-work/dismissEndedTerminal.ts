import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly terminalId: string;
};

export const dismissEndedTerminal = ({ set }: Pick<SliceDeps, 'set'>) => {
  return ({ terminalId }: Params): void => {
    set((state) => {
      if (state.endedWork === null) {
        return {};
      }
      const terminals = Object.fromEntries(
        Object.entries(state.endedWork.terminals).filter(([id]) => id !== terminalId),
      );
      return { endedWork: { ...state.endedWork, terminals } };
    });
  };
};
