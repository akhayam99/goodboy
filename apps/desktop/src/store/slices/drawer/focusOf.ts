import type { DrawerFocus, DrawerGrid, OpenDrawer } from './state';
import { toolsByUseOf } from './toolsByUseOf';

type Params = {
  readonly grid: DrawerGrid;
  readonly detail: OpenDrawer | null;
};

export const focusOf = ({ grid, detail }: Params): DrawerFocus => {
  const { focus } = grid;
  if (focus.at === 'page') {
    return focus;
  }
  if (focus.at === 'detail' && detail !== null) {
    return focus;
  }
  const tools = toolsByUseOf({ grid });
  if (focus.at === 'tool' && tools.some((panel) => panel.kind === focus.kind)) {
    return focus;
  }
  const recent = tools.at(-1);
  if (recent !== undefined) {
    return { at: 'tool', kind: recent.kind };
  }
  return detail === null ? { at: 'page' } : { at: 'detail' };
};
