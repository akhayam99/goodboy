import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { indexLinkedSessions, type LinkedSessionIndex } from '../attachLinkedSession';

type Params = { readonly workspaceId: WorkspaceId };

export const useInboxLinkedSessions = ({ workspaceId }: Params): LinkedSessionIndex => {
  const sessionIds = useAppStore(
    useShallow((state) =>
      state.sessions
        .filter((session) => session.workspaceId === workspaceId)
        .map((session) => session.id),
    ),
  );
  const taskLists = useAppStore(
    useShallow((state) =>
      sessionIds.map((sessionId) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY),
    ),
  );
  return useMemo(
    () =>
      indexLinkedSessions({
        sessionIds,
        sessionExternalTasks: Object.fromEntries(
          sessionIds.map((sessionId, index) => [sessionId, taskLists[index] ?? EMPTY_ARRAY]),
        ),
      }),
    [sessionIds, taskLists],
  );
};
