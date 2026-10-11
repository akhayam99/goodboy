import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';
import { persistTerminalNames } from './persistTerminalNames';
import { folderName, terminalOwnerKey } from './terminalOwner';
import type { GetFn, SetFn } from './types';

type RenameParams = {
  readonly owner: TerminalOwner;
  readonly tabId: TerminalTabId;
  readonly title: string;
};

export const renameTerminalTab = (set: SetFn, get: GetFn) => {
  return async ({ owner, tabId, title }: RenameParams): Promise<void> => {
    const key = terminalOwnerKey({ owner });
    const tab = (get().terminalTabs[key] ?? []).find((candidate) => candidate.id === tabId);
    const next = title.trim();
    if (tab === undefined || next === '' || next === tab.title) {
      return;
    }
    const fallback = folderName({ path: tab.cwd });
    const names = Object.fromEntries(
      Object.entries(get().terminalNames).filter(([id]) => id !== tabId),
    );
    const nextNames = next === fallback ? names : { ...names, [tabId]: next };
    await persistTerminalNames({ names: nextNames });
    set((s) => ({
      terminalNames: nextNames,
      terminalTabs: {
        ...s.terminalTabs,
        [key]: (s.terminalTabs[key] ?? []).map((t) => (t.id === tabId ? { ...t, title: next } : t)),
      },
    }));
  };
};
