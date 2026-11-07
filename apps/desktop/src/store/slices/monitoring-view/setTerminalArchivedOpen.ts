import type { SetFn } from './types';

type Props = {
  readonly set: SetFn;
};

type Params = {
  readonly isOpen: boolean;
};

export const setTerminalArchivedOpen = ({ set }: Props) => {
  return ({ isOpen }: Params): void => {
    set({ isTerminalArchivedOpen: isOpen });
  };
};
