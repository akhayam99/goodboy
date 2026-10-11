import type { LearnedPorts, WatchedByProject } from '@goodboy/core';

type Params = {
  readonly scanned: WatchedByProject;
  readonly watched: LearnedPorts;
  readonly learned: LearnedPorts;
};

export const watchedPortSet = ({ scanned, watched, learned }: Params): ReadonlySet<number> => {
  const ports = new Set<number>();
  for (const list of Object.values(scanned)) {
    for (const item of list) {
      ports.add(item.port);
    }
  }
  for (const list of [...Object.values(watched), ...Object.values(learned)]) {
    for (const port of list) {
      ports.add(port);
    }
  }
  return ports;
};
