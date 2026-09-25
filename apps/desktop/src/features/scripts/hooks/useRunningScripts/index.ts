import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ScriptRunRecord } from '../../scripts';

export type RunningScript = {
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
  readonly scriptId: string;
  readonly mountId: MountId | null;
  readonly scriptName: string;
  readonly startedAt: number;
};

type PendingScriptRun = {
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly mountId: MountId | null;
  readonly runId: string;
  readonly name: string | null;
  readonly startedAt: number;
};

const NO_RUNNING_SCRIPTS: ReadonlyArray<RunningScript> = [];

type CollectParams = {
  readonly scriptRuns: Readonly<Record<string, Readonly<Record<string, ScriptRunRecord>>>>;
  readonly previous: ReadonlyMap<string, PendingScriptRun>;
};

const collectPendingRuns = ({
  scriptRuns,
  previous,
}: CollectParams): ReadonlyMap<string, PendingScriptRun> => {
  const next = new Map<string, PendingScriptRun>();
  for (const [sessionId, runs] of Object.entries(scriptRuns)) {
    for (const [scriptId, record] of Object.entries(runs)) {
      if (record.status !== 'pending') {
        continue;
      }
      const kept = previous.get(record.runId) ?? null;
      next.set(
        record.runId,
        kept ?? {
          sessionId: sessionId as SessionId,
          scriptId,
          mountId: record.mountId ?? null,
          runId: record.runId,
          name: record.name ?? null,
          startedAt: record.startedAt,
        },
      );
    }
  }
  return next;
};

export const useRunningScripts = (): ReadonlyArray<RunningScript> => {
  const pendingCache = useRef<ReadonlyMap<string, PendingScriptRun>>(new Map());
  const pendingRuns = useAppStore(
    useShallow((state) => {
      const next = collectPendingRuns({
        scriptRuns: state.scriptRuns,
        previous: pendingCache.current,
      });
      pendingCache.current = next;
      return [...next.values()];
    }),
  );
  const sessions = useAppStore((state) => state.sessions);
  const archivedSessions = useAppStore((state) => state.archivedSessions);
  const projectScripts = useAppStore((state) => state.projectScripts);

  return useMemo(() => {
    if (pendingRuns.length === 0) {
      return NO_RUNNING_SCRIPTS;
    }
    const sessionById = new Map(
      Object.values(archivedSessions ?? {})
        .flat()
        .map((session) => [session.id, session] as const),
    );
    for (const session of sessions) {
      sessionById.set(session.id, session);
    }
    const running: RunningScript[] = [];
    for (const run of pendingRuns) {
      const session = sessionById.get(run.sessionId) ?? null;
      if (session === null) {
        continue;
      }
      const scriptName =
        run.name ??
        (projectScripts[session.workspaceId] ?? []).find((script) => script.id === run.scriptId)
          ?.name ??
        'script';
      running.push({
        sessionId: run.sessionId,
        sessionGoal: session.goal,
        scriptId: run.scriptId,
        mountId: run.mountId,
        scriptName,
        startedAt: run.startedAt,
      });
    }
    return running.sort((a, b) => a.startedAt - b.startedAt);
  }, [archivedSessions, pendingRuns, projectScripts, sessions]);
};
