import { DOCK_FOCUS_DETAIL, DOCK_FOCUS_PAGE } from '@goodboy/ui';
import type { ShellPanels } from './shellPanelsOf';

type Params = {
  readonly panels: ShellPanels;
};

export const panelFocusKeyOf = ({ panels }: Params): string => {
  const { focus } = panels;
  if (focus.at === 'detail') {
    return panels.detail === null ? DOCK_FOCUS_PAGE : DOCK_FOCUS_DETAIL;
  }
  if (focus.at === 'tool') {
    const isShown = panels.tools.some((column) =>
      column.some((panel) => panel.kind === focus.kind),
    );
    return isShown ? focus.kind : DOCK_FOCUS_PAGE;
  }
  return DOCK_FOCUS_PAGE;
};
