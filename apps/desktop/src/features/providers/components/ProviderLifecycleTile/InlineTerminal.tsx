import { useMemo } from 'react';
import {
  GenericTerminalPanel,
  type TerminalDriver,
} from '../../../../shared/components/GenericTerminalPanel';
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

interface Props {
  readonly runId: string;
  readonly isActive: boolean;
}

// Wraps GenericTerminalPanel with a lifecycle-scoped driver. The driver
// filters output/exit events by runId so concurrent lifecycle runs (e.g. user
// installs claude then immediately starts codex install) never bleed into
// each other's xterm view.
export function InlineTerminal({ runId, isActive }: Props) {
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
          if (payload.runId !== runId) return;
          handler(base64ToBytes(payload.data));
        }),
      onExit: (handler) =>
        listenLifecycleExit((payload) => {
          if (payload.runId !== runId) return;
          handler(payload.exitCode);
        }),
    }),
    [runId],
  );

  return (
    <div className="h-44 overflow-hidden rounded-md border border-border-soft bg-background">
      <GenericTerminalPanel terminalId={runId} driver={driver} isActive={isActive} exitMessage="" />
    </div>
  );
}
