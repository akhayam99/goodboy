import { useMemo } from 'react';
import type { SessionId, WorkspaceScriptId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

export type RunningScript = {
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
  readonly scriptId: WorkspaceScriptId;
  readonly scriptName: string;
  readonly startedAt: number;
};

export const useRunningScripts = (): ReadonlyArray<RunningScript> => {
  const scriptRuns = useAppStore((state) => state.scriptRuns);
  const sessions = useAppStore((state) => state.sessions);
  const workspaceScripts = useAppStore((state) => state.workspaceScripts);

  return useMemo(() => {
    const names = new Map(
      Object.values(workspaceScripts).flatMap((scripts) =>
        scripts.map((script) => [script.id, script.name] as const),
      ),
    );
    const running: RunningScript[] = [];
    for (const session of sessions) {
      const sessionId = session.id as SessionId;
      const runs = scriptRuns[sessionId];
      if (runs === undefined) {
        continue;
      }
      for (const [scriptId, record] of Object.entries(runs)) {
        if (record.status !== 'pending') {
          continue;
        }
        const id = scriptId as WorkspaceScriptId;
        running.push({
          sessionId,
          sessionGoal: session.goal,
          scriptId: id,
          scriptName: names.get(id) ?? 'script',
          startedAt: record.startedAt,
        });
      }
    }
    return running.sort((a, b) => a.startedAt - b.startedAt);
  }, [scriptRuns, workspaceScripts, sessions]);
};
