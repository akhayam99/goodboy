import type { ProjectId } from '@goodboy/types';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';

const POLL_INTERVAL_MS = 30_000;

type LoadParams = {
  readonly projectId: ProjectId;
};

type Load = (params: LoadParams) => void;

type Watcher = {
  readonly projectIds: ReadonlyArray<ProjectId>;
  readonly load: Load;
};

type Params = Watcher;

const watchers = new Set<Watcher>();
let stopPoll: (() => void) | null = null;

const pollAll = (): void => {
  const loaded = new Set<ProjectId>();
  for (const watcher of watchers) {
    for (const projectId of watcher.projectIds) {
      if (loaded.has(projectId)) {
        continue;
      }
      loaded.add(projectId);
      watcher.load({ projectId });
    }
  }
};

export const watchProjectGitStatuses = ({ projectIds, load }: Params): (() => void) => {
  const watcher: Watcher = { projectIds, load };
  watchers.add(watcher);
  for (const projectId of projectIds) {
    load({ projectId });
  }
  if (stopPoll === null) {
    stopPoll = startPoll({
      run: pollAll,
      everyMs: POLL_INTERVAL_MS,
      gate: 'visible',
      isImmediate: false,
    });
  }
  return () => {
    watchers.delete(watcher);
    if (watchers.size === 0 && stopPoll !== null) {
      stopPoll();
      stopPoll = null;
    }
  };
};
