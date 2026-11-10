import { isWorkspaceTool } from './isWorkspaceTool';
import type { OpenDrawer } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type KeepParams = {
  readonly drawer: OpenDrawer | null;
};

const sessionBound = ({ drawer }: KeepParams): OpenDrawer | null =>
  drawer === null || isWorkspaceTool({ content: drawer }) ? null : drawer;

export const closeWorkspaceTools = ({ set }: Params) => {
  return (): void => {
    set((state) => {
      const drawer = sessionBound({ drawer: state.drawer ?? null });
      const back = sessionBound({ drawer: state.drawerBack ?? null });
      if (drawer === state.drawer && back === state.drawerBack) {
        return state;
      }
      return drawer === null ? { drawer: back, drawerBack: null } : { drawer, drawerBack: back };
    });
  };
};
