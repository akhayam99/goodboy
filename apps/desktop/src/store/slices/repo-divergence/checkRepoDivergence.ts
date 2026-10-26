import type { WorkspaceId } from '@goodboy/types';
import { runWithLimit } from '../../../shared/utils/runWithLimit';
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
      await runWithLimit({
        tasks: projects.map((project) => () => readRepoDivergence({ set, get, project, maxAgeMs })),
        limit: CHECK_CONCURRENCY,
      });
      set((state) => ({ repoCheckedAt: { ...state.repoCheckedAt, [workspaceId]: Date.now() } }));
    } finally {
      setInFlight({ set, workspaceId, isInFlight: false });
    }
    return 'checked';
  };
};
