import type { MonitorSnapshot } from '@goodboy/core';

type Params = {
  readonly known: MonitorSnapshot | null;
  readonly narrow: MonitorSnapshot;
  readonly ports: ReadonlyArray<number>;
};

export const mergePortSnapshot = ({ known, narrow, ports }: Params): MonitorSnapshot => {
  if (known === null) {
    return narrow;
  }
  const narrowPids = new Set(narrow.processes.map((process) => process.pid));
  const evictedPids = new Set(
    known.listeners
      .filter((listener) => ports.includes(listener.port))
      .map((listener) => listener.pid),
  );
  const stillListeningPids = new Set(
    known.listeners
      .filter((listener) => !ports.includes(listener.port))
      .map((listener) => listener.pid),
  );
  return {
    listeners: [
      ...known.listeners.filter((listener) => !ports.includes(listener.port)),
      ...narrow.listeners,
    ].sort((a, b) => a.port - b.port || a.pid - b.pid),
    processes: [
      ...narrow.processes,
      ...known.processes.filter(
        (process) =>
          !narrowPids.has(process.pid) &&
          (!evictedPids.has(process.pid) || stillListeningPids.has(process.pid)),
      ),
    ],
    takenAt: narrow.takenAt,
    isPlatformSupported: narrow.isPlatformSupported,
  };
};
