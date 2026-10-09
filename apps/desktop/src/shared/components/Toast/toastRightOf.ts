export const TOAST_GUTTER_PX = 12;

export type ToastDrawerMode = 'push' | 'overlay' | 'closed';

type Params = {
  readonly mode: ToastDrawerMode;
  readonly drawerWidth: number;
};

export const toastRightOf = ({ mode, drawerWidth }: Params): number => {
  if (mode !== 'push') {
    return TOAST_GUTTER_PX;
  }
  return Math.round(drawerWidth) + TOAST_GUTTER_PX;
};
