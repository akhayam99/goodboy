import { useEffect, useMemo } from 'react';
import {
  LazyGenericTerminalPanel,
  type TerminalDriver,
} from '../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel';
import { invokeProviderLifecycleResize, invokeProviderLifecycleWrite } from '../provider-lifecycle';
import { lifecycleOutputBuffer } from '../lifecycleOutputBuffer';

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
      onOutput: async (handler) => {
        await lifecycleOutputBuffer.register();
        return lifecycleOutputBuffer.subscribe({ runId, subscriber: { onOutput: handler } });
      },
      onExit: async (handler) => {
        await lifecycleOutputBuffer.register();
        return lifecycleOutputBuffer.subscribe({ runId, subscriber: { onExit: handler } });
      },
      snapshot: async () => lifecycleOutputBuffer.snapshotOf({ runId }),
    }),
    [runId],
  );

  useEffect(() => () => lifecycleOutputBuffer.release({ runId }), [runId]);

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
