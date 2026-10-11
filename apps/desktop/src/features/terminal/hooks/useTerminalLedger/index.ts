import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../../store';
import { createLatestOnly } from '../../../../store/slices/state-writes/latestOnly';
import { invokeTerminalListLive } from '../../terminal';

const POLL_MS = 2000;
const LEDGER_KEY = 'terminal-ledger';

type Params = {
  readonly isEnabled: boolean;
};

const NO_BUSY: ReadonlySet<string> = new Set();

export const useTerminalLedger = ({ isEnabled }: Params): ReadonlySet<string> => {
  const [busy, setBusy] = useState<ReadonlySet<string>>(NO_BUSY);
  const hasReported = useRef(false);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    const latest = createLatestOnly();
    const poll = (): void => {
      latest
        .run({
          key: LEDGER_KEY,
          request: invokeTerminalListLive,
          apply: (live) =>
            setBusy(
              new Set(
                live
                  .filter(
                    (terminal) =>
                      terminal.pid !== null &&
                      terminal.foregroundPid !== null &&
                      terminal.pid !== terminal.foregroundPid,
                  )
                  .map((terminal) => terminal.id),
              ),
            ),
        })
        .catch((error) => {
          if (hasReported.current) {
            return;
          }
          hasReported.current = true;
          void useAppStore.getState().reportError({
            title: 'Could not read which terminals are busy',
            error,
            severity: 'warning',
          });
        });
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      window.clearInterval(timer);
      latest.cancel({ key: LEDGER_KEY });
    };
  }, [isEnabled]);

  return busy;
};
