import { collectLearnedPorts, type LedgerRow, type MonitorSnapshot } from '@goodboy/core';
import { setSetting } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../state-writes/latestOnly';
import { learnedPortsKey } from './settingKeys';
import { mergePortSnapshot } from './mergePortSnapshot';
import { selectPortRows } from './selectPortRows';
import type { SliceDeps } from '../../slice-types';

const LATEST_KEY = 'monitor-snapshot';

type Fetched = {
  readonly snapshot: MonitorSnapshot;
  readonly ledger: ReadonlyArray<LedgerRow>;
};

type ScanParams = {
  readonly ports?: ReadonlyArray<number>;
};

const fetchBoth = async ({ ports }: ScanParams): Promise<Fetched> => {
  const [snapshot, ledger] = await Promise.all([
    invokeCommand<MonitorSnapshot>('monitor_snapshot', ports === undefined ? {} : { ports }),
    invokeCommand<ReadonlyArray<LedgerRow>>('process_ledger_list'),
  ]);
  return { snapshot, ledger };
};

type PortsParams = {
  readonly ports: ReadonlyArray<number>;
};

type QueueParams = {
  readonly ports: ReadonlyArray<number>;
  readonly current: Promise<void>;
};

export const createMonitorRefresh = ({ set, get }: SliceDeps) => {
  const latest = createLatestOnly();
  let inflight: Promise<void> | null = null;
  let isInflightNarrow = false;
  let isFullPending = false;
  let followUp: Promise<void> | null = null;
  const queued = new Set<number>();

  const persistLearned = async (): Promise<void> => {
    const state = get();
    const learned = collectLearnedPorts({
      rows: selectPortRows(state),
      learned: state.monitorLearned,
    });
    if (learned === state.monitorLearned) {
      return;
    }
    for (const [projectId, ports] of Object.entries(learned)) {
      if (ports === state.monitorLearned[projectId]) {
        continue;
      }
      await setSetting(tauriDatabase, learnedPortsKey({ projectId }), JSON.stringify(ports));
    }
    set((current) => ({
      monitorLearned: { ...current.monitorLearned, ...learned },
    }));
  };

  const run = async ({ ports }: ScanParams): Promise<void> => {
    try {
      await latest.run({
        key: LATEST_KEY,
        request: () => fetchBoth({ ...(ports !== undefined && { ports }) }),
        apply: ({ snapshot, ledger }) => {
          const known = get().monitorSnapshot;
          if (known !== null && snapshot.takenAt < known.takenAt) {
            return;
          }
          set({
            monitorSnapshot:
              ports === undefined
                ? snapshot
                : mergePortSnapshot({ known, narrow: snapshot, ports }),
            monitorLedger: ledger,
            monitorError: null,
          });
        },
      });
      if (ports !== undefined) {
        return;
      }
      await persistLearned();
    } catch (error) {
      set({ monitorError: formatError(error) });
    }
  };

  const queuePorts = ({ ports, current }: QueueParams): Promise<void> => {
    for (const port of ports) {
      queued.add(port);
    }
    if (followUp !== null) {
      return followUp;
    }
    followUp = current.then(() => {
      const union = [...queued];
      queued.clear();
      followUp = null;
      if (union.length === 0 || isFullPending) {
        return inflight ?? Promise.resolve();
      }
      return start({ ports: union });
    });
    return followUp;
  };

  const start = ({ ports }: ScanParams): Promise<void> => {
    if (inflight !== null) {
      if (ports !== undefined) {
        return queuePorts({ ports, current: inflight });
      }
      if (isInflightNarrow) {
        isFullPending = true;
        return inflight.then(() => {
          isFullPending = false;
          return start({});
        });
      }
      return inflight;
    }
    isInflightNarrow = ports !== undefined;
    if (ports === undefined) {
      queued.clear();
    }
    inflight = run({ ...(ports !== undefined && { ports }) }).finally(() => {
      inflight = null;
    });
    return inflight;
  };

  return {
    refreshMonitorSnapshot: (): Promise<void> => start({}),
    refreshMonitorPorts: ({ ports }: PortsParams): Promise<void> => start({ ports }),
  };
};
