import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

export type RunningScript = {
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
  readonly scriptId: string;
  readonly scriptName: string;
  readonly startedAt: number;
};

export const useRunningScripts = (): ReadonlyArray<RunningScript> => {
  const scriptRuns = useAppStore((state) => state.scriptRuns);
  const sessions = useAppStore((state) => state.sessions);
  const projectScripts = useAppStore((state) => state.projectScripts);

  return useMemo(() => {
    const running: RunningScript[] = [];
    for (const session of sessions) {
      const sessionId = session.id as SessionId;
      const runs = scriptRuns[sessionId];
      if (runs === undefined) {
        continue;
      }
      const names = new Map<string, string>(
        (projectScripts[session.workspaceId] ?? []).map(
          (script) => [script.id, script.name] as const,
        ),
      );
      for (const [scriptId, record] of Object.entries(runs)) {
        if (record.status !== 'pending') {
          continue;
        }
        running.push({
          sessionId,
          sessionGoal: session.goal,
          scriptId,
          scriptName: record.name ?? names.get(scriptId) ?? 'script',
          startedAt: record.startedAt,
        });
      }
    }
    return running.sort((a, b) => a.startedAt - b.startedAt);
  }, [scriptRuns, projectScripts, sessions]);
};
