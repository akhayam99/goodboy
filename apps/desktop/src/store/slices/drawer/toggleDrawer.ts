import { drawerKey } from './drawerKey';
import { isWorkspaceTool } from './isWorkspaceTool';
import { selectDrawerPanel } from './selectDrawerPanel';
import type { DrawerRequest } from './state';
import type { GetFn } from './types';

export const toggleDrawer = (get: GetFn) => {
  return (request: DrawerRequest): void => {
    const studio = get().appStudio;
    const isOnPage =
      studio !== null && (!isWorkspaceTool({ content: request }) || studio.kind === request.kind);
    if (isOnPage) {
      get().closeStudio();
    }
    const current = selectDrawerPanel(get());
    const isSame =
      current !== null &&
      current.sessionId === request.sessionId &&
      drawerKey(current) === drawerKey(request);
    if (isSame && isOnPage) {
      return;
    }
    if (isSame) {
      get().closeDrawer();
      return;
    }
    get().openDrawer(request);
  };
};
