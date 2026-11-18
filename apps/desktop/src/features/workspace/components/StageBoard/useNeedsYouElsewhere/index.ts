import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useProjectFilteredSessions, useWorkspaceAttention } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

type NeedsYou = {
  readonly count: number;
  readonly elsewhere: number;
};

export const useNeedsYouElsewhere = ({ workspaceId, sessions }: Params): NeedsYou => {
  const attention = useWorkspaceAttention({ workspaceId, sessions });
  const shown = useProjectFilteredSessions({ workspaceId, sessions });
  return useMemo(() => {
    const shownIds = new Set<string>(shown.map((session) => session.id));
    return {
      count: attention.count,
      elsewhere: attention.countedIds.filter((id) => !shownIds.has(id)).length,
    };
  }, [attention.count, attention.countedIds, shown]);
};
