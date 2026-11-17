import { DOCK_FOCUS_DETAIL, DOCK_FOCUS_PAGE } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { panelFocusKeyOf } from '../../store/slices/drawer/panelFocusKeyOf';
import { shellPanelsOf } from '../../store/slices/drawer/shellPanelsOf';

type Params = {
  readonly key: string;
};

export const focusShellPanel = ({ key }: Params): void => {
  const state = useAppStore.getState();
  const panels = shellPanelsOf({ state });
  if (panelFocusKeyOf({ panels }) === key) {
    return;
  }
  if (key === DOCK_FOCUS_PAGE) {
    state.focusDrawerPanel({ target: { at: 'page' } });
    return;
  }
  const entry =
    key === DOCK_FOCUS_DETAIL
      ? panels.detail
      : (panels.tools.flat().find((panel) => panel.kind === key) ?? null);
  if (entry === null) {
    return;
  }
  state.focusDrawerPanel({ target: { at: 'panel', entry } });
};
