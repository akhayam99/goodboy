import { leaveStudio } from '../navigation/leaveStudio';
import { drawerKey } from './drawerKey';
import { isWorkspaceTool } from './isWorkspaceTool';
import { selectDetailDrawer } from './selectDetailDrawer';
import { selectGridTool } from './selectGridTool';
import type { DrawerRequest, OpenDrawer } from './state';
import type { GetFn } from './types';

type ShownParams = {
  readonly state: ReturnType<GetFn>;
  readonly request: DrawerRequest;
};

const shownFor = ({ state, request }: ShownParams): OpenDrawer | null => {
  if (isWorkspaceTool({ content: request })) {
    return selectGridTool({ state, kind: request.kind });
  }
  return state.appStudio === null ? selectDetailDrawer({ state }) : null;
};

export const toggleDrawer = (get: GetFn) => {
  return (request: DrawerRequest): void => {
    const studio = get().appStudio;
    const isOnPage =
      studio !== null && (!isWorkspaceTool({ content: request }) || studio.kind === request.kind);
    if (isOnPage) {
      leaveStudio({ get });
    }
    const state = get();
    const shown = shownFor({ state, request });
    const isSame =
      shown !== null &&
      shown.sessionId === request.sessionId &&
      drawerKey(shown) === drawerKey(request);
    if (isSame && isOnPage) {
      return;
    }
    if (isSame) {
      state.closeDrawerEntry({ entry: shown });
      return;
    }
    state.openDrawer(request);
  };
};
