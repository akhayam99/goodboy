import { collectLearnedPorts, type LedgerRow, type MonitorSnapshot } from '@goodboy/core';
import { setSetting } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../state-writes/latestOnly';
import { learnedPortsKey } from './settingKeys';
import { selectPortRows } from './selectPortRows';
import type { GetFn, SetFn } from './types';

const LATEST_KEY = 'monitor-snapshot';

type Fetched = {
  readonly snapshot: MonitorSnapshot;
  readonly ledger: ReadonlyArray<LedgerRow>;
};

const fetchBoth = async (): Promise<Fetched> => {
  const [snapshot, ledger] = await Promise.all([
    invokeCommand<MonitorSnapshot>('monitor_snapshot'),
    invokeCommand<ReadonlyArray<LedgerRow>>('process_ledger_list'),
  ]);
  return { snapshot, ledger };
};

export const refreshMonitorSnapshot = (set: SetFn, get: GetFn) => {
  const latest = createLatestOnly();
  let inflight: Promise<void> | null = null;

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

  const run = async (): Promise<void> => {
    try {
      await latest.run({
        key: LATEST_KEY,
        request: fetchBoth,
        apply: ({ snapshot, ledger }) => {
          const known = get().monitorSnapshot;
          if (known !== null && snapshot.takenAt < known.takenAt) {
            return;
          }
          set({ monitorSnapshot: snapshot, monitorLedger: ledger, monitorError: null });
        },
      });
      await persistLearned();
    } catch (error) {
      set({ monitorError: formatError(error) });
    }
  };

  return (): Promise<void> => {
    if (inflight !== null) {
      return inflight;
    }
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  };
};
