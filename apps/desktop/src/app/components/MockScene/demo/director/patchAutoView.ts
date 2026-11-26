import type { SessionId } from '@goodboy/types';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import type { DirectorStore } from './directorTypes';

type ViewParams = {
  readonly view: AutoTreeView;
};

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly patch: (params: ViewParams) => AutoTreeView;
};

export const patchAutoView = ({ store, sessionId, patch }: Params): void => {
  store.setState((state) => ({
    autoTreeViews: {
      ...state.autoTreeViews,
      [sessionId]: (state.autoTreeViews[sessionId] ?? []).map((view) => patch({ view })),
    },
  }));
};
