import { useMemo } from 'react';
import { EMPTY_ARRAY, useAppStore, useCurrentWorkspace } from '../../../store';
import { useNowSessions } from '../../../shared/hooks/useNowSessions';
import { stageInfoOf } from '../../../store/slices/session-view/stageInfoOf';
import { attentionPlace } from '../../session/attentionPlace';
import { needsYouEntries } from '../sources/needsYouEntries';
import type { PaletteEntry } from '../types';

export const useNeedsYouEntries = (): ReadonlyArray<PaletteEntry> => {
  const workspace = useCurrentWorkspace();
  const { needsYou } = useNowSessions({});
  const navigate = useAppStore((state) => state.navigate);

  return useMemo(() => {
    if (workspace === null) {
      return EMPTY_ARRAY;
    }
    const state = useAppStore.getState();
    return needsYouEntries({
      items: needsYou.map((session) => ({ session, info: stageInfoOf(state, session) })),
      open: ({ sessionId, attention: reason }) =>
        navigate({ to: attentionPlace({ state: useAppStore.getState(), sessionId, reason }) }),
    });
  }, [needsYou, navigate, workspace]);
};
