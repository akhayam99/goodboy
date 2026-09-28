import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../../session/sessionTitle';
import type { PaletteScope } from '../../../palette/types';
import type { SearchProjectOption } from '../../grammar';
import type { SearchScope } from '../../searchScope';

export type SearchContext = {
  readonly initialScope: SearchScope;
  readonly workspaceLabel: string | null;
  readonly projects: ReadonlyArray<SearchProjectOption>;
};

type Params = {
  readonly paletteScope: PaletteScope | null;
};

export const useSearchContext = ({ paletteScope }: Params): SearchContext => {
  const sessionId =
    paletteScope === null || paletteScope.kind === 'workspace' ? null : paletteScope.sessionId;
  const session = useAppStore((state) =>
    sessionId === null
      ? null
      : (state.sessions.find((candidate) => candidate.id === sessionId) ?? null),
  );
  const workspaceId =
    paletteScope?.kind === 'workspace' ? paletteScope.workspaceId : (session?.workspaceId ?? null);
  const workspaceLabel = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? null,
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
