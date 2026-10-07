import { useMemo } from 'react';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useSessions,
  useStageGroupedSessions,
} from '../../../store';
import { stageInfoOf } from '../../../store/slices/session-view/stageInfoOf';
import { attentionPlace } from '../../session/attentionPlace';
import { needsYouEntries } from '../sources/needsYouEntries';
import type { PaletteEntry } from '../types';

export const useNeedsYouEntries = (): ReadonlyArray<PaletteEntry> => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const groups = useStageGroupedSessions(workspace?.id ?? null, sessions);
  const navigate = useAppStore((state) => state.navigate);

  return useMemo(() => {
    if (workspace === null) {
      return EMPTY_ARRAY;
    }
    const state = useAppStore.getState();
    const attention = groups.find((group) => group.key === 'attention')?.sessions ?? EMPTY_ARRAY;
    return needsYouEntries({
      items: attention.map((session) => ({ session, info: stageInfoOf(state, session) })),
      open: ({ sessionId, attention: reason }) =>
        navigate({ to: attentionPlace({ state: useAppStore.getState(), sessionId, reason }) }),
    });
  }, [groups, navigate, workspace]);
};
