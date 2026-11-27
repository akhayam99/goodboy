import { dismissTopEscapeLayer } from '@goodboy/ui';
import { isOverlayOpen } from '../../../shared/keyboard/isOverlayOpen';
import { useAppStore } from '../../../store';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';

type Params = Record<never, never>;

export const closeCurrentLevel = ({}: Params): void => {
  if (isOverlayOpen({})) {
    dismissTopEscapeLayer();
    return;
  }
  const state = useAppStore.getState();
  const drawer = selectDrawerPanel(state);
  if (drawer?.kind === 'question') {
    state.closeQuestion();
    return;
  }
  if (drawer !== null) {
    state.closeDrawer();
    return;
  }
  const live = captureLocation({ state });
  if (live.studio !== null) {
    state.closeStudio();
    return;
  }
  if (live.place.at === 'home' || live.place.at === 'board') {
    return;
  }
  state.up();
};
