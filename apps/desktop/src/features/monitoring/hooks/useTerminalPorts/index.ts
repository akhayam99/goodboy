import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../store';
import { createLatestOnly } from '../../../../store/slices/state-writes/latestOnly';
import { invokeTerminalListLive } from '../../../terminal/terminal';
import { portsOfProcessTree } from '../../portsOfProcessTree';
import { useMonitorPolling } from '../useMonitorPolling';

const POLL_MS = 5000;
const LIVE_KEY = 'terminal-ports-live';

type Roots = ReadonlyMap<string, number>;

const NO_ROOTS: Roots = new Map();
const NO_PORTS: ReadonlyMap<string, ReadonlyArray<number>> = new Map();

export const useTerminalPorts = (): ReadonlyMap<string, ReadonlyArray<number>> => {
  useMonitorPolling();
  const snapshot = useAppStore((state) => state.monitorSnapshot);
  const [roots, setRoots] = useState<Roots>(NO_ROOTS);

  useEffect(() => {
    const latest = createLatestOnly();
    const poll = (): void => {
      latest
        .run({
          key: LIVE_KEY,
          request: invokeTerminalListLive,
          apply: (live) =>
            setRoots(
              new Map(
                live.flatMap((terminal) =>
                  terminal.pid === null ? [] : [[terminal.id, terminal.pid] as const],
                ),
              ),
            ),
        })
        .catch(() => undefined);
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      window.clearInterval(timer);
      latest.cancel({ key: LIVE_KEY });
    };
  }, []);

  return useMemo(() => {
    if (snapshot === null || roots.size === 0) {
      return NO_PORTS;
    }
    const byTerminal = new Map<string, ReadonlyArray<number>>();
    for (const [terminalId, rootPid] of roots) {
      const ports = portsOfProcessTree({ snapshot, rootPid });
      if (ports.length > 0) {
        byTerminal.set(terminalId, ports);
      }
    }
    return byTerminal;
  }, [snapshot, roots]);
};
