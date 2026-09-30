import { useEffect, useMemo } from 'react';
import type { Session, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { useProjectMountsForSessions } from '../project-mounts/useProjectMountsForSessions';
import { sessionMatchesProjectFilter } from './sessionMatchesProjectFilter';

const EMPTY_PROJECT_FILTER_IDS: ReadonlyArray<string> = [];
const EMPTY_PROJECT_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type UseSelectedProjectIdsParams = {
  readonly workspaceId: WorkspaceId | null;
};

export const useSelectedProjectIds = ({
  workspaceId,
}: UseSelectedProjectIdsParams): ReadonlyArray<string> => {
  const selectedProjectIds = useAppStore((state) =>
    workspaceId !== null ? (state.selectedProjectIds[workspaceId] ?? null) : null,
  );
  const getSelectedProjectIds = useAppStore((state) => state.getSelectedProjectIds);

  useEffect(() => {
    if (workspaceId === null || selectedProjectIds !== null) {
      return;
    }
    getSelectedProjectIds({ workspaceId });
  }, [getSelectedProjectIds, selectedProjectIds, workspaceId]);

  return selectedProjectIds ?? EMPTY_PROJECT_FILTER_IDS;
};

type UseProjectFilteredSessionsParams = UseSelectedProjectIdsParams & {
  readonly sessions: ReadonlyArray<Session>;
};

export const useProjectFilteredSessions = ({
  workspaceId,
  sessions,
}: UseProjectFilteredSessionsParams): ReadonlyArray<Session> => {
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const sessionProjectMounts = useProjectMountsForSessions({ sessions });
  return useMemo(
    () =>
      sessions.filter((session) =>
        sessionMatchesProjectFilter({
          mounts: sessionProjectMounts[session.id] ?? EMPTY_PROJECT_MOUNTS,
          selectedProjectIds,
        }),
      ),
    [selectedProjectIds, sessionProjectMounts, sessions],
  );
};
