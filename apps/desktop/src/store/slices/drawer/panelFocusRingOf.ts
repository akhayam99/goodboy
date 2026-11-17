import { DOCK_FOCUS_DETAIL, DOCK_FOCUS_PAGE } from '@goodboy/ui';
import type { ShellPanels } from './shellPanelsOf';

type Params = {
  readonly panels: ShellPanels;
};

export const panelFocusRingOf = ({ panels }: Params): ReadonlyArray<string> => [
  DOCK_FOCUS_PAGE,
  ...(panels.detail === null ? [] : [DOCK_FOCUS_DETAIL]),
  ...panels.tools.flatMap((column) => column.map((panel) => panel.kind)),
];
