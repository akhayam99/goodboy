import { BOARD_PLACE, useAppStore } from '../../store';
import { destinationStudioOf } from '../../store/slices/navigation/destinationStudioOf';
import { selectIsSessionDraftShown } from '../../store/slices/sessionDraft/selectIsSessionDraftShown';
import type { DestinationId } from './destinations';

type Params = {
  readonly id: DestinationId;
};

export const openDestination = ({ id }: Params): void => {
  const state = useAppStore.getState();
  if (id === 'board') {
    if (state.currentSessionId !== null || selectIsSessionDraftShown({ state })) {
      state.navigate({ to: BOARD_PLACE });
      return;
    }
    if (state.appStudio !== null) {
      state.closeStudio();
    }
    return;
  }
  state.switchStudio({ studio: destinationStudioOf({ id, state }) });
};
