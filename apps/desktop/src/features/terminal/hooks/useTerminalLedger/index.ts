import { useEffect, useMemo, useRef, useState } from 'react';
import { usePoll } from '../../../../shared/lib/usePoll';
import { useAppStore } from '../../../../store';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { foregroundLabelOf } from '../../foregroundLabelOf';
import { isBusyTerminal } from '../../isBusyTerminal';
import { invokeTerminalListLive } from '../../terminal';

const POLL_MS = 2000;
const LEDGER_KEY = 'terminal-ledger';

type Params = {
  readonly isEnabled: boolean;
};

export type TerminalLedger = {
  readonly busy: ReadonlySet<string>;
  readonly commands: ReadonlyMap<string, string>;
};

const NO_LEDGER: TerminalLedger = { busy: new Set(), commands: new Map() };

export const useTerminalLedger = ({ isEnabled }: Params): TerminalLedger => {
  const [ledger, setLedger] = useState<TerminalLedger>(NO_LEDGER);
  const hasReported = useRef(false);

  const latest = useMemo(() => createLatestOnly(), []);

  const poll = (): void => {
    latest
      .run({
        key: LEDGER_KEY,
        request: invokeTerminalListLive,
        apply: (live) => {
          const busyTerminals = live.filter((terminal) => isBusyTerminal({ terminal }));
          setLedger({
            busy: new Set(busyTerminals.map((terminal) => terminal.id)),
            commands: new Map(
              busyTerminals.flatMap((terminal) => {
                const label = foregroundLabelOf({ command: terminal.foregroundCommand ?? '' });
                return label === '' ? [] : [[terminal.id, label] as const];
              }),
            ),
          });
        },
      })
      .catch((error) => {
        if (hasReported.current) {
          return;
        }
        hasReported.current = true;
        void useAppStore.getState().reportError({
          title: "Couldn't read which terminals are busy",
          error,
          severity: 'warning',
        });
      });
  };

  usePoll({ run: poll, everyMs: POLL_MS, isEnabled });

  useEffect(() => {
    return () => latest.cancel({ key: LEDGER_KEY });
  }, [isEnabled, latest]);

  return ledger;
};
