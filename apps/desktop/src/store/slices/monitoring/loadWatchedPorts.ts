import type { WatchedPort } from '@goodboy/core';
import { getSetting } from '@goodboy/db';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { enqueuePortWrite } from './enqueuePortWrite';
import { loadPinnedPorts } from './loadPinnedPorts';
import { parsePortList } from './parsePortList';
import { learnedPortsKey } from './settingKeys';
import type { GetFn, SetFn } from './types';

type ProjectTarget = {
  readonly projectId: string;
  readonly rootPath: string;
};

type Loaded = {
  readonly projectId: string;
  readonly scanned: ReadonlyArray<WatchedPort>;
  readonly learned: ReadonlyArray<number>;
};

const loadOne = async ({ projectId, rootPath }: ProjectTarget): Promise<Loaded> => {
  const [scanned, learnedRaw] = await Promise.all([
    invokeCommand<ReadonlyArray<WatchedPort>>('monitor_watched_ports', { projectRoot: rootPath }),
    getSetting(tauriDatabase, learnedPortsKey({ projectId })),
  ]);
  return {
    projectId,
    scanned,
    learned: parsePortList({ raw: learnedRaw }),
  };
};

export const loadWatchedPorts = (set: SetFn, get: GetFn) => {
  const loadPins = (): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        try {
          const { pinned, hidden } = await loadPinnedPorts();
          set({ monitorPinned: pinned, monitorHidden: hidden });
        } catch (error) {
          await get().reportError({ title: "Couldn't read pinned ports", error });
        }
      },
    });

  return async (): Promise<void> => {
    const targets = get()
      .projects.filter((project) => project.disconnectedAt === undefined)
      .map((project) => ({ projectId: project.id, rootPath: project.rootPath }));
    const [settled] = await Promise.all([Promise.allSettled(targets.map(loadOne)), loadPins()]);
    const loaded = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    set((state) => {
      const monitorScanned = { ...state.monitorScanned };
      const monitorLearned = { ...state.monitorLearned };
      for (const item of loaded) {
        monitorScanned[item.projectId] = item.scanned;
        monitorLearned[item.projectId] = [
          ...new Set([...(state.monitorLearned[item.projectId] ?? []), ...item.learned]),
        ].sort((a, b) => a - b);
      }
      return { monitorScanned, monitorLearned };
    });
  };
};
