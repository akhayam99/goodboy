export const TOAST_GUTTER_PX = 12;

export type ToastDrawerMode = 'push' | 'overlay' | 'closed';

type Params = {
  readonly mode: ToastDrawerMode;
  readonly drawerWidth: number;
  readonly hasNativeView?: boolean;
};

export const toastRightOf = ({ mode, drawerWidth, hasNativeView = false }: Params): number => {
  if (mode === 'closed' || (mode === 'overlay' && !hasNativeView)) {
    return TOAST_GUTTER_PX;
  }
  return Math.round(drawerWidth) + TOAST_GUTTER_PX;
};
