import type { MonitorSnapshot } from '@goodboy/core/monitoring';
import type { MonitoringView } from './state';

type Params = {
  readonly views: Readonly<Record<string, MonitoringView>>;
  readonly snapshot: MonitorSnapshot;
};

const PROCESS_PREFIX = 'proc:';

export const pruneProcessFolds = ({
  views,
  snapshot,
}: Params): Readonly<Record<string, MonitoringView>> => {
  const alive = new Set(snapshot.processes.map((item) => `${item.pid}:${item.startedAt}`));
  let next: Record<string, MonitoringView> | null = null;
  for (const [workspaceId, view] of Object.entries(views)) {
    const kept = view.openFolds.filter((key) => {
      if (!key.startsWith(PROCESS_PREFIX)) {
        return true;
      }
      const [pid, startedAt] = key.slice(PROCESS_PREFIX.length).split(':');
      return alive.has(`${pid}:${startedAt}`);
    });
    if (kept.length === view.openFolds.length) {
      continue;
    }
    next = next ?? { ...views };
    next[workspaceId] = { ...view, openFolds: kept };
  }
  return next ?? views;
};
