import { closeSlotEntry } from './closeSlotEntry';
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
    set((state) => closeSlotEntry({ state, entry }));
  };
};
