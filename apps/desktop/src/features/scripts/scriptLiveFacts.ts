import type { MonitorSnapshot } from '@goodboy/core';

export type ScriptLiveFacts = {
  readonly pid: number;
  readonly ports: ReadonlyArray<number>;
  readonly cpuPercent: number;
  readonly rssBytes: number;
};

type Params = {
  readonly snapshot: MonitorSnapshot | null;
  readonly pid: number;
};

export const scriptLiveFacts = ({ snapshot, pid }: Params): ScriptLiveFacts => {
  if (snapshot === null) {
    return { pid, ports: [], cpuPercent: 0, rssBytes: 0 };
  }
  const tree = new Set<number>([pid]);
  let isGrowing = true;
  while (isGrowing) {
    isGrowing = false;
    for (const process of snapshot.processes) {
      const isMember = process.pgid === pid || tree.has(process.ppid);
      if (isMember && !tree.has(process.pid)) {
        tree.add(process.pid);
        isGrowing = true;
      }
    }
  }
  const members = snapshot.processes.filter((process) => tree.has(process.pid));
  const ports = [
    ...new Set(snapshot.listeners.filter((listener) => tree.has(listener.pid)).map((l) => l.port)),
  ].sort((a, b) => a - b);
  return {
    pid,
    ports,
    cpuPercent: members.reduce((sum, process) => sum + process.cpuPercent, 0),
    rssBytes: members.reduce((sum, process) => sum + process.rssBytes, 0),
  };
};
