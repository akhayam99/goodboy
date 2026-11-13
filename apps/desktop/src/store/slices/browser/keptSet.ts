import type { AppStore } from '../../store';
import type { SetFn } from '../../slice-types';
import { keepTabCounts } from './keepTabCounts';

type Params = {
  readonly set: SetFn;
};

export const keptSet = ({ set }: Params): SetFn => {
  return (patch) =>
    set((state: AppStore) =>
      keepTabCounts({ state, patch: typeof patch === 'function' ? patch(state) : patch }),
    );
};
