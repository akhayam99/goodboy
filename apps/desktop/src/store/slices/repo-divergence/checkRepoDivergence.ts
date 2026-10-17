import type { WorkspaceId } from '@goodboy/types';
import { runWithConcurrency } from '../../../shared/lib/concurrency';
import { readRepoDivergence } from './readRepoDivergence';
import { workspaceReposOf } from './workspaceReposOf';
import type { CheckOutcome, GetFn, SetFn } from './types';

const CHECK_CONCURRENCY = 4;

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly maxAgeMs: number;
};

type FlightParams = {
  readonly set: SetFn;
  readonly workspaceId: WorkspaceId;
  readonly isInFlight: boolean;
};

const setInFlight = ({ set, workspaceId, isInFlight }: FlightParams): void => {
  set((state) => ({
    repoCheckInFlight: { ...state.repoCheckInFlight, [workspaceId]: isInFlight },
  }));
};

export const checkRepoDivergence = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, maxAgeMs }: Input): Promise<CheckOutcome> => {
    if (get().repoCheckInFlight[workspaceId] === true) {
      return 'skipped';
    }
    const projects = workspaceReposOf({ projects: get().projects, workspaceId });
    if (projects.length === 0) {
      return 'skipped';
    }
    setInFlight({ set, workspaceId, isInFlight: true });
    try {
      await runWithConcurrency({
        items: projects,
        limit: CHECK_CONCURRENCY,
        run: (project) => readRepoDivergence({ set, get, project, maxAgeMs }),
      });
      set((state) => ({ repoCheckedAt: { ...state.repoCheckedAt, [workspaceId]: Date.now() } }));
    } finally {
      setInFlight({ set, workspaceId, isInFlight: false });
    }
    return 'checked';
  };
};
