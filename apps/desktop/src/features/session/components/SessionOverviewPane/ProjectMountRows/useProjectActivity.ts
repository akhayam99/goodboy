import { useMemo } from 'react';
import type { ProjectId, ProjectScriptId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId | null;
};

type ProjectActivity = {
  readonly liveTerminals: number;
  readonly runningScripts: number;
};

export const useProjectActivity = ({
  sessionId,
  projectId,
  workspaceId,
}: Params): ProjectActivity => {
  const liveTerminals = useAppStore((state) => {
    const tabs = state.terminalTabs[sessionId];
    if (tabs === undefined) {
      return 0;
    }
    return tabs.filter((tab) => tab.projectId === projectId && tab.status !== 'exited').length;
  });

  const runningScripts = useAppStore((state) => {
    if (workspaceId === null) {
      return 0;
    }
    const runs = state.scriptRuns[sessionId];
    if (runs === undefined) {
      return 0;
    }
    const owned = new Set<ProjectScriptId>(
      (state.projectScripts[workspaceId] ?? [])
        .filter((script) => script.projectId === projectId)
        .map((script) => script.id),
    );
    return Object.entries(runs).filter(
      ([scriptId, record]) => record.status === 'pending' && owned.has(scriptId as ProjectScriptId),
    ).length;
  });

  return useMemo(() => ({ liveTerminals, runningScripts }), [liveTerminals, runningScripts]);
};
