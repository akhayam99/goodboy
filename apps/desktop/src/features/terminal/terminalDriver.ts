import type { TerminalDriver } from '../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel';
import { trackTerminalInput } from './commandTracker';
import { terminalOutputBus } from './outputBus';
import { invokeTerminalResize, invokeTerminalSnapshot, invokeTerminalWrite } from './terminal';

type DriverParams = {
  readonly terminalId: string;
};

type Base64Params = {
  readonly value: string;
};

const base64ToBytes = ({ value }: Base64Params): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const stringToBase64 = ({ value }: Base64Params): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const createTerminalDriver = ({ terminalId }: DriverParams): TerminalDriver => ({
  write: (data: string) => {
    trackTerminalInput({ terminalId, data });
    void invokeTerminalWrite(terminalId, stringToBase64({ value: data }));
  },
  resize: (cols: number, rows: number) => {
    void invokeTerminalResize(terminalId, cols, rows);
  },
  onOutput: async (handler) => {
    await terminalOutputBus.register();
    return terminalOutputBus.subscribe({ terminalId, subscriber: { onOutput: handler } });
  },
  onExit: async (handler) => {
    await terminalOutputBus.register();
    return terminalOutputBus.subscribe({ terminalId, subscriber: { onExit: handler } });
  },
  snapshot: async () => {
    try {
      const snapshot = await invokeTerminalSnapshot(terminalId);
      return {
        bytes: base64ToBytes({ value: snapshot.data }),
        offset: snapshot.offset,
        exitCode: snapshot.exitCode,
      };
    } catch {
      const tail = terminalOutputBus.tailOf({ terminalId });
      return tail === null ? null : { ...tail, exitCode: null };
    }
  },
});
