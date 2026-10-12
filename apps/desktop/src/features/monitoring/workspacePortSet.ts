import type { WatchedByProject } from '@goodboy/core';

type Params = {
  readonly scanned: WatchedByProject;
};

export const workspacePortSet = ({ scanned }: Params): ReadonlySet<number> => {
  const ports = new Set<number>();
  for (const list of Object.values(scanned)) {
    for (const item of list) {
      ports.add(item.port);
    }
  }
  return ports;
};
