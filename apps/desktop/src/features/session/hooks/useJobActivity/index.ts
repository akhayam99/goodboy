import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  jobFactsByAgentId,
  type JobActivityFacts,
} from '../../../../store/slices/history/jobFactsByAgentId';
import { resolveMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';

export type JobActivity = {
  readonly factsByAgentId: ReadonlyMap<string, JobActivityFacts>;
};

type UseJobActivityParams = {
  readonly sessionId: SessionId;
};

export const useJobActivity = ({ sessionId }: UseJobActivityParams): JobActivity => {
  const historyRuns = useAppStore((s) => s.historyRuns);
  const scribeWork = useAppStore((s) => s.scribeWork);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((s) => s.projects);
  return useMemo(
    () => ({
      factsByAgentId: jobFactsByAgentId({
        sessionId,
        historyRuns,
        scribeWork,
        events,
        contextOf: ({ mountId }) => {
          const mount = mounts.find((candidate) => candidate.mountId === mountId) ?? null;
          return {
            projectName: mount?.mountName ?? 'this branch',
            baseBranch: resolveMountBaseBranch({ mount, projects }) ?? 'main',
          };
        },
      }),
    }),
    [events, historyRuns, mounts, projects, scribeWork, sessionId],
  );
};
