import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { invokeTerminalWrite } from './terminal';

type Params = {
  readonly terminalId: string;
  readonly encoded: string;
};

export const writeTerminalInput = async ({ terminalId, encoded }: Params): Promise<void> => {
  try {
    await invokeTerminalWrite(terminalId, encoded);
  } catch (error) {
    await useAppStore.getState().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: "Terminal isn't accepting input",
      body: formatError(error),
      coalesceKey: `terminal-input:${terminalId}`,
      isOnce: true,
    });
  }
};
