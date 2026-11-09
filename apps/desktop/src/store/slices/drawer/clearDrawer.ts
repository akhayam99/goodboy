import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const clearDrawer = ({ set }: Params) => {
  return (): void => {
    set((state) =>
      state.drawer === null && state.drawerBack === null
        ? state
        : { drawer: null, drawerBack: null },
    );
  };
};
