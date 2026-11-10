import { leaveStudio } from '../navigation/leaveStudio';
import { drawerKey } from './drawerKey';
import { selectDrawerPanel } from './selectDrawerPanel';
import type { DrawerRequest } from './state';
import type { GetFn } from './types';

export const toggleDrawer = (get: GetFn) => {
  return (request: DrawerRequest): void => {
    const isOnPage = get().appStudio !== null;
    if (isOnPage) {
      leaveStudio({ get });
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
