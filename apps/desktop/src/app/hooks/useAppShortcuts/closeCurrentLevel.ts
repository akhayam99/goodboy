import { dismissTopEscapeLayer } from '@goodboy/ui';
import { isOverlayOpen } from '../../../shared/keyboard/isOverlayOpen';
import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { parentPlace } from '../../../store/slices/navigation/parentPlace';

type Params = Record<never, never>;

export const closeCurrentLevel = ({}: Params): void => {
  if (isOverlayOpen({})) {
    dismissTopEscapeLayer();
    return;
  }
  const state = useAppStore.getState();
  if (selectOpenDrawer(state) !== null) {
    state.closeDrawer();
    return;
  }
  const live = captureLocation({ state });
  if (live.studio !== null) {
    state.closeStudio();
    return;
  }
  if (live.place.at === 'board') {
    return;
  }
  if (parentPlace({ state, place: live.place }) !== null) {
    state.up();
    return;
  }
  state.back();
};
