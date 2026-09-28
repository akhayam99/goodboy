import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { indexLinkedSessions, type LinkedSessionIndex } from '../attachLinkedSession';

type Params = { readonly workspaceId: WorkspaceId };

export const useInboxLinkedSessions = ({ workspaceId }: Params): LinkedSessionIndex =>
  useAppStore(
    useShallow((state) =>
      indexLinkedSessions({
        sessionIds: state.sessions
          .filter((session) => session.workspaceId === workspaceId)
          .map((session) => session.id),
        sessionExternalTasks: state.sessionExternalTasks,
      }),
    ),
  );
