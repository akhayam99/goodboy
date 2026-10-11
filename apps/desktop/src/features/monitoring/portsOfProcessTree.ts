import type { MonitorSnapshot } from '@goodboy/core';

type Params = {
  readonly snapshot: MonitorSnapshot | null;
  readonly rootPid: number;
};

const MAX_DEPTH = 64;

export const portsOfProcessTree = ({ snapshot, rootPid }: Params): ReadonlyArray<number> => {
  if (snapshot === null) {
    return [];
  }
  const parents = new Map<number, number>();
  for (const process of snapshot.processes) {
    parents.set(process.pid, process.ppid);
  }
  const isInTree = (pid: number): boolean => {
    let current: number | undefined = pid;
    for (let depth = 0; depth < MAX_DEPTH && current !== undefined; depth += 1) {
      if (current === rootPid) {
        return true;
      }
      current = parents.get(current);
    }
    return false;
  };
  return [
    ...new Set(snapshot.listeners.filter((listener) => isInTree(listener.pid)).map((l) => l.port)),
  ].sort((a, b) => a - b);
};
