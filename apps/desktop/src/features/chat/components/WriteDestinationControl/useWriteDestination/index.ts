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
  type WriteDestinationMount,
} from '../../../../../store/slices/project-mounts/writeDestination';
import { scratchDirPrepare } from '../../../../../features/worktree/worktree';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export type WriteDestinationView = Readonly<{
  next: WriteDestination;
  candidates: ReadonlyArray<WriteDestinationMount>;
  running: WriteDestination | null;
  diverges: boolean;
}>;

export const useWriteDestination = ({ sessionId, agentId }: Params): WriteDestinationView => {
  const sessions = useAppStore((state) => state.sessions);
  const sessionActiveMount = useAppStore((state) => state.sessionActiveMount);
  const sessionActiveProject = useAppStore((state) => state.sessionActiveProject);
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
      sessions,
      sessionActiveMount,
      sessionActiveProject,
      sessionMounts: sessionMounts === undefined ? {} : { [sessionId]: sessionMounts },
      sessionProjectMounts:
        sessionProjectMounts === undefined ? {} : { [sessionId]: sessionProjectMounts },
    }),
    [
      sessions,
      sessionActiveMount,
      sessionActiveProject,
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
    if (activeMount !== null) {
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
  }, [activeMount, sessionId]);

  const next = useMemo(
    () =>
      resolveWriteDestination({ mount: activeMount, projectName: activeProjectName, scratchPath }),
    [activeMount, activeProjectName, scratchPath],
  );

  const running = turnKind === 'running' ? turnDestination : null;
  const diverges = running !== null && !writeDestinationsMatch(running, next);

  return { next, candidates, running, diverges };
};
