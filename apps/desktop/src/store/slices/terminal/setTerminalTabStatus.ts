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
  readonly openError?: string;
};

export const setTerminalTabStatus = (set: SetFn) => {
  return ({ owner, tabId, status, openError }: StatusParams): void => {
    const key = terminalOwnerKey({ owner });
    set((s) => ({
      terminalTabs: {
        ...s.terminalTabs,
        [key]: (s.terminalTabs[key] ?? []).map((t) =>
          t.id === tabId
            ? {
                ...t,
                status,
                ...(openError === undefined ? {} : { openError }),
              }
            : t,
        ),
      },
    }));
  };
};
