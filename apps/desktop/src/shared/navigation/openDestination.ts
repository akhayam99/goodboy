import { BOARD_PLACE, useAppStore } from '../../store';
import { destinationStudioOf } from '../../store/slices/navigation/destinationStudioOf';
import { selectIsSessionDraftShown } from '../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { isStudioOverSession } from './columnPlace';
import type { PageDestinationId } from './destinations';
import { selectColumnPlace } from './selectColumnPlace';

type Params = {
  readonly id: PageDestinationId | 'board';
};

export const openDestination = ({ id }: Params): void => {
  const state = useAppStore.getState();
  if (id === 'board') {
    if (
      state.currentSessionId !== null ||
      state.appStudio !== null ||
      selectIsSessionDraftShown({ state })
    ) {
      state.navigate({ to: BOARD_PLACE, ...(state.appStudio !== null && { mode: 'replace' }) });
    }
    return;
  }
  const place = selectColumnPlace({ state });
  if (isStudioOverSession({ place }) && place === id) {
    return;
  }
  state.switchStudio({ studio: destinationStudioOf({ id, state }) });
};
