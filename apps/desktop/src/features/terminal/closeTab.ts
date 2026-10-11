import type { TerminalTabId } from '../../shared/types/terminal';
import { terminalOutputBus } from './outputBus';
import { invokeTerminalClose } from './terminal';

export const disposeTerminalPty = (id: TerminalTabId): void => {
  void invokeTerminalClose(id).catch(() => undefined);
  terminalOutputBus.forget({ terminalId: id });
};
