import { pickReloadSurface } from './pickReloadSurface';
import { reloadSurfaces } from './reloadSurfaces';

export const reloadWhereYouAre = (): void => {
  const surface = pickReloadSurface({
    surfaces: reloadSurfaces.list(),
    touched: reloadSurfaces.lastTouched() ?? document.activeElement,
    hasWindowFocus: document.hasFocus(),
  });
  surface?.reload();
};
