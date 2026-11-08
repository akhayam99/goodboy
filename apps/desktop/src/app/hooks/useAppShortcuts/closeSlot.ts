import { dismissTopEscapeLayer } from '@goodboy/ui';
import { isOverlayOpen } from '../../../shared/keyboard/isOverlayOpen';
import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';

type Params = Record<never, never>;

export const closeSlot = ({}: Params): void => {
  if (isOverlayOpen({})) {
    dismissTopEscapeLayer();
    return;
  }
  const state = useAppStore.getState();
  const drawer = selectOpenDrawer(state);
  if (drawer === null) {
    return;
  }
  if (drawer.kind === 'question') {
    state.closeQuestion();
    return;
  }
  state.closeDrawer();
};
