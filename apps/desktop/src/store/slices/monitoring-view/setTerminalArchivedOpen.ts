import type { SetFn } from './types';

type Props = {
  readonly set: SetFn;
};

type Params = {
  readonly workspaceId: string;
  readonly isOpen: boolean;
};

export const setTerminalArchivedOpen = ({ set }: Props) => {
  return ({ workspaceId, isOpen }: Params): void => {
    set((state) => ({
      terminalArchivedOpen: { ...state.terminalArchivedOpen, [workspaceId]: isOpen },
    }));
  };
};
