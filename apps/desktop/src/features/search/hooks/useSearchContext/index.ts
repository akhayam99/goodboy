import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../../session/sessionTitle';
import type { SearchProjectOption } from '../../grammar';
import type { SearchScope } from '../../searchScope';

export type SearchContext = {
  readonly initialScope: SearchScope;
  readonly workspaceLabel: string | null;
  readonly projects: ReadonlyArray<SearchProjectOption>;
};

export const useSearchContext = (): SearchContext => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const sessionId = useAppStore((state) => state.currentSessionId);
  const workspaceLabel = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? null,
  );
  const session = useAppStore((state) =>
    sessionId === null
      ? null
      : (state.sessions.find((candidate) => candidate.id === sessionId) ?? null),
  );
  const allProjects = useAppStore((state) => state.projects);
  const projects = useMemo(
    () =>
      allProjects
        .filter((project) => project.disconnectedAt == null)
        .map((project) => ({ id: project.id, name: project.name })),
    [allProjects],
  );

  const initialScope = useMemo((): SearchScope => {
    if (session !== null) {
      return {
        kind: 'session',
        sessionId: session.id,
        workspaceId: session.workspaceId,
        label: sessionTitle({ session }),
      };
    }
    if (workspaceId !== null && workspaceLabel !== null) {
      return { kind: 'workspace', workspaceId, label: workspaceLabel };
    }
    return { kind: 'all' };
  }, [session, workspaceId, workspaceLabel]);

  return { initialScope, workspaceLabel, projects };
};
