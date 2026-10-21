import { BOARD_PLACE, useAppStore } from '../../../store';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { parentPlace } from '../../../store/slices/navigation/parentPlace';

type Params = Record<never, never>;

export const goUp = ({}: Params): void => {
  const state = useAppStore.getState();
  const live = captureLocation({ state });
  if (
    live.studio === null &&
    live.place.at === 'session' &&
    parentPlace({ state, place: live.place }) === null
  ) {
    state.navigate({ to: BOARD_PLACE });
    return;
  }
  state.up();
};
