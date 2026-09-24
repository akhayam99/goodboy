import { useMemo } from 'react';
import {
  LazyGenericTerminalPanel,
  type TerminalDriver,
} from '../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel';
import {
  invokeProviderLifecycleResize,
  invokeProviderLifecycleWrite,
  listenLifecycleExit,
  listenLifecycleOutput,
} from '../../provider-lifecycle';

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

type Props = {
  readonly runId: string;
  readonly isActive: boolean;
  readonly heightClass?: string;
};

export const InlineTerminal = ({ runId, isActive, heightClass = 'h-44' }: Props) => {
  const driver = useMemo<TerminalDriver>(
    () => ({
      write: (data) => {
        void invokeProviderLifecycleWrite(runId, stringToBase64(data));
      },
      resize: (cols, rows) => {
        void invokeProviderLifecycleResize(runId, cols, rows);
      },
      onOutput: (handler) =>
        listenLifecycleOutput((payload) => {
          if (payload.runId !== runId) {
            return;
          }
          handler(base64ToBytes(payload.data));
        }),
      onExit: (handler) =>
        listenLifecycleExit((payload) => {
          if (payload.runId !== runId) {
            return;
          }
          handler(payload.exitCode);
        }),
    }),
    [runId],
  );

  return (
    <div
      className={`${heightClass} overflow-hidden rounded-md border border-border-soft bg-background`}
    >
      <LazyGenericTerminalPanel
        terminalId={runId}
        driver={driver}
        isActive={isActive}
        exitMessage=""
      />
    </div>
  );
};
