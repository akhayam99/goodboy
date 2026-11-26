import { pickReloadSurface } from './pickReloadSurface';
import { reloadSurfaces } from './reloadSurfaces';

type Params = {
  readonly reloadApp: () => void;
};

export const reloadAppOrPage = ({ reloadApp }: Params): void => {
  const surface = pickReloadSurface({
    surfaces: reloadSurfaces.list(),
    touched: reloadSurfaces.lastTouched() ?? document.activeElement,
    hasWindowFocus: document.hasFocus(),
  });
  if (surface?.reloadFromOrigin === undefined) {
    reloadApp();
    return;
  }
  surface.reloadFromOrigin();
};
