import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';

type Params = Record<never, never>;

export const closeSlot = ({}: Params): void => {
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
