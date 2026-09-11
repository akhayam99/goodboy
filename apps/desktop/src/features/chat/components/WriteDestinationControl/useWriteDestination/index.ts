import { useEffect, useMemo, useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  selectActiveMount,
  selectWritableMounts,
} from '../../../../../store/slices/project-mounts/selectors';
import {
  listWriteDestinationCandidates,
  resolveWriteDestination,
  writeDestinationsMatch,
  type WriteDestination,
  type WriteDestinationCandidate,
} from '../../../../../store/slices/project-mounts/writeDestination';
import { scratchDirPrepare } from '../../../../../features/worktree/worktree';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export type WriteDestinationView = Readonly<{
  next: WriteDestination;
  candidates: ReadonlyArray<WriteDestinationCandidate>;
  running: WriteDestination | null;
  diverges: boolean;
}>;

export const useWriteDestination = ({ sessionId, agentId }: Params): WriteDestinationView => {
  const session = useAppStore((state) =>
    state.sessions.find((candidate) => candidate.id === sessionId),
  );
  const sessionActiveMountId = useAppStore((state) => state.sessionActiveMount[sessionId]);
  const sessionActiveProjectId = useAppStore((state) => state.sessionActiveProject[sessionId]);
  const sessionMounts = useAppStore((state) => state.sessionMounts[sessionId]);
  const sessionProjectMounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);
  const projects = useAppStore((state) => state.projects);
  const turnKind = useAppStore((state) =>
    agentId === null ? null : (state.agentTurnState[agentId]?.kind ?? null),
  );
  const turnDestination = useAppStore((state) =>
    agentId === null ? null : (state.agentTurnDestination[agentId] ?? null),
  );

  const mountState = useMemo(
    () => ({
      sessions: session === undefined ? [] : [session],
      sessionActiveMount:
        sessionActiveMountId === undefined ? {} : { [sessionId]: sessionActiveMountId },
      sessionActiveProject:
        sessionActiveProjectId === undefined ? {} : { [sessionId]: sessionActiveProjectId },
      sessionMounts: sessionMounts === undefined ? {} : { [sessionId]: sessionMounts },
      sessionProjectMounts:
        sessionProjectMounts === undefined ? {} : { [sessionId]: sessionProjectMounts },
    }),
    [
      session,
      sessionActiveMountId,
      sessionActiveProjectId,
      sessionMounts,
      sessionProjectMounts,
      sessionId,
    ],
  );

  const activeMount = useMemo(
    () => selectActiveMount({ state: mountState, sessionId }),
    [mountState, sessionId],
  );
  const writableMounts = useMemo(
    () => selectWritableMounts({ state: mountState, sessionId }),
    [mountState, sessionId],
  );
  const candidates = useMemo(
    () => listWriteDestinationCandidates({ mounts: writableMounts, projects }),
    [writableMounts, projects],
  );
  const activeProjectName = useMemo(
    () =>
      activeMount === null
        ? null
        : (projects.find((project) => project.id === activeMount.projectId)?.name ?? null),
    [activeMount, projects],
  );

  const [scratchPath, setScratchPath] = useState<string | null>(null);
  useEffect(() => {
    if (activeMount !== null || writableMounts.length > 0) {
      return;
    }
    let cancelled = false;
    scratchDirPrepare({ sessionId })
      .then((path) => {
        if (!cancelled) {
          setScratchPath(path);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeMount, sessionId, writableMounts]);

  const next = useMemo(
    () =>
      resolveWriteDestination({
        mount: activeMount,
        projectName: activeProjectName,
        scratchPath,
        mountCount: writableMounts.length,
      }),
    [activeMount, activeProjectName, scratchPath, writableMounts],
  );

  const running = turnKind === 'running' ? turnDestination : null;
  const diverges = running !== null && !writeDestinationsMatch(running, next);

  return { next, candidates, running, diverges };
};
