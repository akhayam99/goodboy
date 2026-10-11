import type { WatchedPort } from '@goodboy/core';
import { getSetting } from '@goodboy/db';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { parsePortList } from './parsePortList';
import { learnedPortsKey, watchedPortsKey } from './settingKeys';
import type { GetFn, SetFn } from './types';

type ProjectTarget = {
  readonly projectId: string;
  readonly rootPath: string;
};

type Loaded = {
  readonly projectId: string;
  readonly scanned: ReadonlyArray<WatchedPort>;
  readonly watched: ReadonlyArray<number>;
  readonly learned: ReadonlyArray<number>;
};

const loadOne = async ({ projectId, rootPath }: ProjectTarget): Promise<Loaded> => {
  const [scanned, watchedRaw, learnedRaw] = await Promise.all([
    invokeCommand<ReadonlyArray<WatchedPort>>('monitor_watched_ports', { projectRoot: rootPath }),
    getSetting(tauriDatabase, watchedPortsKey({ projectId })),
    getSetting(tauriDatabase, learnedPortsKey({ projectId })),
  ]);
  return {
    projectId,
    scanned,
    watched: parsePortList({ raw: watchedRaw }),
    learned: parsePortList({ raw: learnedRaw }),
  };
};

export const loadWatchedPorts = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const targets = get()
      .projects.filter((project) => project.disconnectedAt === undefined)
      .map((project) => ({ projectId: project.id, rootPath: project.rootPath }));
    const settled = await Promise.allSettled(targets.map(loadOne));
    const loaded = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    set((state) => {
      const monitorScanned = { ...state.monitorScanned };
      const monitorWatched = { ...state.monitorWatched };
      const monitorLearned = { ...state.monitorLearned };
      for (const item of loaded) {
        monitorScanned[item.projectId] = item.scanned;
        monitorWatched[item.projectId] = item.watched;
        monitorLearned[item.projectId] = [
          ...new Set([...(state.monitorLearned[item.projectId] ?? []), ...item.learned]),
        ].sort((a, b) => a - b);
      }
      return { monitorScanned, monitorWatched, monitorLearned };
    });
  };
};
