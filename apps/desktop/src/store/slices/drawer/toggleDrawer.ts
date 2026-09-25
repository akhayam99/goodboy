import { drawerKey } from './drawerKey';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { DrawerRequest } from './state';
import type { GetFn } from './types';

export const toggleDrawer = (get: GetFn) => {
  return (request: DrawerRequest): void => {
    const current = selectOpenDrawer(get());
    const isSame =
      current !== null &&
      current.sessionId === request.sessionId &&
      drawerKey(current) === drawerKey(request);
    if (isSame) {
      get().closeDrawer();
      return;
    }
    get().openDrawer(request);
  };
};
