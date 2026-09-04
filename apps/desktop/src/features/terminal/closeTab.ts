import { clearTerminalCache } from '../../shared/components/GenericTerminalPanel/outputCache';
import type { TerminalTabId } from '../../shared/types/terminal';
import { invokeTerminalClose } from './terminal';

export const disposeTerminalPty = (id: TerminalTabId): void => {
  void invokeTerminalClose(id).catch(() => undefined);
  clearTerminalCache(id);
};
