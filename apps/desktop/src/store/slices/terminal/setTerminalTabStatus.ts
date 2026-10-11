import type {
  TerminalOwner,
  TerminalTabId,
  TerminalTabStatus,
} from '../../../shared/types/terminal';
import { terminalOwnerKey } from './terminalOwner';
import type { SetFn } from './types';

type StatusParams = {
  readonly owner: TerminalOwner;
  readonly tabId: TerminalTabId;
  readonly status: TerminalTabStatus;
  readonly exitCode?: number;
  readonly openError?: string;
};

export const setTerminalTabStatus = (set: SetFn) => {
  return ({ owner, tabId, status, exitCode, openError }: StatusParams): void => {
    const key = terminalOwnerKey({ owner });
    set((s) => ({
      terminalTabs: {
        ...s.terminalTabs,
        [key]: (s.terminalTabs[key] ?? []).map((t) =>
          t.id === tabId
            ? {
                ...t,
                status,
                ...(exitCode === undefined ? {} : { exitCode }),
                ...(openError === undefined ? {} : { openError }),
              }
            : t,
        ),
      },
    }));
  };
};
