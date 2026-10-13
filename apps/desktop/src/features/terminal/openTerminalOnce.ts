import type { TerminalOwner, TerminalTabId } from '../../shared/types/terminal';
import { useAppStore } from '../../store';
import { terminalOwnerKey } from '../../store/slices/terminal/terminalOwner';
import { stringToBase64 } from './terminalDriver';
import { invokeTerminalOpen, invokeTerminalWrite } from './terminal';

type Params = {
  readonly id: TerminalTabId;
  readonly cwd: string | null;
  readonly owner: TerminalOwner;
};

const pendingOpens = new Map<TerminalTabId, Promise<void>>();

const currentPrefill = ({ id, owner }: Pick<Params, 'id' | 'owner'>): string | undefined => {
  const key = terminalOwnerKey({ owner });
  return useAppStore.getState().terminalTabs[key]?.find((t) => t.id === id)?.prefill;
};

const openAndType = async ({ id, cwd, owner }: Params): Promise<void> => {
  await invokeTerminalOpen(id, cwd, 100, 24);
  const prefill = currentPrefill({ id, owner });
  if (prefill === undefined) {
    return;
  }
  await invokeTerminalWrite(id, stringToBase64({ value: prefill }));
  useAppStore.getState().setTerminalPrefill({ owner, tabId: id, prefill: null });
};

export const openTerminalOnce = ({ id, cwd, owner }: Params): Promise<void> => {
  const pending = pendingOpens.get(id);
  if (pending !== undefined) {
    return pending;
  }
  const started = openAndType({ id, cwd, owner }).finally(() => {
    if (pendingOpens.get(id) === started) {
      pendingOpens.delete(id);
    }
  });
  pendingOpens.set(id, started);
  return started;
};
