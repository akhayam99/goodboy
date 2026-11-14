import type { OpenDrawer } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type EntryParams = {
  readonly entry: OpenDrawer;
};

export const closeDrawerEntry = ({ set }: Params) => {
  return ({ entry }: EntryParams): void => {
    set((state) => {
      if (state.drawer === entry) {
        return { drawer: state.drawerBack ?? null, drawerBack: null };
      }
      if (state.drawerBack === entry) {
        return { drawerBack: null };
      }
      return state;
    });
  };
};
