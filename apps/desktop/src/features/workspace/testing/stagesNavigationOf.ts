import type { WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: AppState;
  readonly workspaceId: WorkspaceId;
};

export const stagesNavigationOf = ({ state, workspaceId }: Params): AppState['navigation'] => ({
  ...state.navigation,
  [workspaceId]: {
    entries: [
      {
        workspaceId,
        place: { at: 'board' },
        studio: null,
        focus: { drawer: null, scroll: {} },
      },
    ],
    index: 0,
  },
});
