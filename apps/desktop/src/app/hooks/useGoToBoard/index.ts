import { useCallback } from 'react';
import { BOARD_PLACE, useAppStore } from '../../../store';
import { selectIsSessionDraftShown } from '../../../store/slices/sessionDraft/selectIsSessionDraftShown';

export const useGoToBoard = (): (() => void) => {
  const navigate = useAppStore((s) => s.navigate);
  const closeStudio = useAppStore((s) => s.closeStudio);

  return useCallback(() => {
    const state = useAppStore.getState();
    if (state.currentSessionId !== null || selectIsSessionDraftShown({ state })) {
      navigate({ to: BOARD_PLACE });
      return;
    }
    if (state.appStudio !== null) {
      closeStudio();
    }
  }, [navigate, closeStudio]);
};
