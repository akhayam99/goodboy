import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useCurrentWorkspace,
  useSessions,
  useStageGroupedSessions,
  useWorkspaceAttention,
  type WorkspaceAttention,
} from '../../../store';

export type NowSessions = {
  readonly needsYou: ReadonlyArray<Session>;
  readonly running: ReadonlyArray<Session>;
  readonly attention: WorkspaceAttention;
};

type Params = Record<never, never>;

export const useNowSessions = ({}: Params): NowSessions => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const groups = useStageGroupedSessions(workspace?.id ?? null, sessions);
  const attention = useWorkspaceAttention({ workspaceId: workspace?.id ?? null, sessions });
  const hasWorkspace = workspace !== null && workspace !== undefined;

  return useMemo(() => {
    if (!hasWorkspace) {
      return { needsYou: EMPTY_ARRAY, running: EMPTY_ARRAY, attention };
    }
    return {
      needsYou: groups.find((group) => group.key === 'attention')?.sessions ?? EMPTY_ARRAY,
      running: groups.find((group) => group.key === 'running')?.sessions ?? EMPTY_ARRAY,
      attention,
    };
  }, [attention, groups, hasWorkspace]);
};
