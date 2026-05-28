import { useCallback, useEffect, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  clearTerminalCache,
  GenericTerminalPanel,
  type TerminalDriver,
} from '../../../../shared/components/GenericTerminalPanel';
import {
  invokeTerminalResize,
  invokeTerminalWrite,
  listenTerminalExit,
  listenTerminalOutput,
} from '../../../terminal/terminal';

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
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly cwd: string | null;
}

export function TerminalPanel({ sessionId, isActive, cwd }: Props) {
  const openTerminal = useAppStore((s) => s.openTerminal);
  const closeTerminal = useAppStore((s) => s.closeTerminal);

  // Session driver: routes write/resize through invokeTerminal* and filters
  // global output/exit events by sessionId before forwarding to the panel.
  const driver = useMemo<TerminalDriver>(
    () => ({
      write: (data: string) => {
        void invokeTerminalWrite(sessionId, stringToBase64(data));
      },
      resize: (cols: number, rows: number) => {
        void invokeTerminalResize(sessionId, cols, rows);
      },
      onOutput: (handler) =>
        listenTerminalOutput((payload) => {
          if (payload.sessionId !== sessionId) return;
          handler(base64ToBytes(payload.data));
        }),
      onExit: (handler) =>
        listenTerminalExit((payload) => {
          if (payload.sessionId !== sessionId) return;
          handler(payload.exitCode);
        }),
    }),
    [sessionId],
  );

  // Lazy-spawn bash on first mount per session. Idempotent on the backend.
  useEffect(() => {
    void openTerminal(sessionId, cwd, 100, 24);
  }, [sessionId, cwd, openTerminal]);

  // Restart: close, clear cache, reopen. The xterm reset is handled by
  // GenericTerminalPanel remount via the cache clear plus exit message.
  const handleRestart = useCallback(() => {
    void (async () => {
      try {
        await closeTerminal(sessionId);
      } catch {
        // best-effort
      }
      clearTerminalCache(sessionId);
      await openTerminal(sessionId, cwd, 100, 24);
    })();
  }, [sessionId, cwd, closeTerminal, openTerminal]);

  return (
    <GenericTerminalPanel
      terminalId={sessionId}
      driver={driver}
      isActive={isActive}
      exitMessage="\r\n\x1B[90m[shell exited, click ↻ to restart]\x1B[0m"
      onRestart={handleRestart}
    />
  );
}
