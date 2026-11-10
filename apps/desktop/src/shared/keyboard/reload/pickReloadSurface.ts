import type { ReloadSurface } from './types';

type Params = {
  readonly surfaces: ReadonlyArray<ReloadSurface>;
  readonly touched: Element | null;
  readonly hasWindowFocus: boolean;
};

export const pickReloadSurface = ({
  surfaces,
  touched,
  hasWindowFocus,
}: Params): ReloadSurface | null => {
  const native = surfaces.find((surface) => surface.hasNativeView);
  if (!hasWindowFocus && native !== undefined) {
    return native;
  }
  const holder =
    touched === null
      ? undefined
      : surfaces.find((surface) => surface.root()?.contains(touched) === true);
  if (holder !== undefined) {
    return holder;
  }
  return surfaces.find((surface) => surface.isMain) ?? null;
};
