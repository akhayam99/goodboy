import { useShallow } from 'zustand/react/shallow';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { recentProjectIdsOf } from '../recentProjectIdsOf';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

const NO_IDS: ReadonlyArray<ProjectId> = [];

export const useRecentProjectIds = ({ workspaceId }: Params): ReadonlyArray<ProjectId> =>
  useAppStore(
    useShallow((state) =>
      workspaceId === null ? NO_IDS : recentProjectIdsOf({ sessions: state.sessions, workspaceId }),
    ),
  );
