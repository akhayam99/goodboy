import { BOARD_PLACE, HOME_PLACE, useAppStore } from '../../store';
import { selectIsHomeShown } from './selectIsHomeShown';
import { destinationStudioOf } from '../../store/slices/navigation/destinationStudioOf';
import { selectIsSessionDraftShown } from '../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { isStudioOverSession } from './columnPlace';
import type { PageDestinationId } from './destinations';
import { selectColumnPlace } from './selectColumnPlace';

type Params = {
  readonly id: PageDestinationId | 'home' | 'board';
};

export const openDestination = ({ id }: Params): void => {
  const state = useAppStore.getState();
  if (id === 'home') {
    if (!selectIsHomeShown({ state }) || state.appStudio !== null) {
      state.navigate({ to: HOME_PLACE, ...(state.appStudio !== null && { mode: 'replace' }) });
    }
    return;
  }
  if (id === 'board') {
    if (
      state.currentSessionId !== null ||
      state.appStudio !== null ||
      selectIsSessionDraftShown({ state }) ||
      selectIsHomeShown({ state })
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
