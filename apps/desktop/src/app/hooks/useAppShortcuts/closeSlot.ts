import { dismissTopEscapeLayer } from '@goodboy/ui';
import { isOverlayOpen } from '../../../shared/keyboard/isOverlayOpen';
import { useAppStore } from '../../../store';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';

type Params = Record<never, never>;

export const closeSlot = ({}: Params): void => {
  if (isOverlayOpen({})) {
    dismissTopEscapeLayer();
    return;
  }
  const state = useAppStore.getState();
  const drawer = selectDrawerPanel(state);
  if (drawer === null) {
    return;
  }
  state.closeDrawer();
};
