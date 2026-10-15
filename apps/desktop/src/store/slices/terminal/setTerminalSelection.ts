import type { TerminalSelection } from '../../../shared/types/terminal';
import { saveTerminalTabs } from './saveTerminalTabs';
import type { GetFn, SetFn } from './types';

type SelectionParams = {
  readonly selection: TerminalSelection | null;
};

export const setTerminalSelection = (set: SetFn, get: GetFn) => {
  return ({ selection }: SelectionParams): void => {
    set({ terminalSelection: selection });
    saveTerminalTabs({ get });
  };
};
