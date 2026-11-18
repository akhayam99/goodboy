import { useAppStore } from '../../store';
import { panelFocusKeyOf } from '../../store/slices/drawer/panelFocusKeyOf';
import { panelFocusRingOf } from '../../store/slices/drawer/panelFocusRingOf';
import { shellPanelsOf } from '../../store/slices/drawer/shellPanelsOf';
import { focusPanelElement } from './focusPanelElement';
import { focusShellPanel } from './focusShellPanel';

type Params = {
  readonly step: 1 | -1;
};

export const stepPanelFocus = ({ step }: Params): void => {
  const panels = shellPanelsOf({ state: useAppStore.getState() });
  const ring = panelFocusRingOf({ panels });
  const from = ring.indexOf(panelFocusKeyOf({ panels }));
  const next = ring[(Math.max(0, from) + step + ring.length) % ring.length];
  if (next === undefined) {
    return;
  }
  focusShellPanel({ key: next });
  focusPanelElement({ key: next });
};
