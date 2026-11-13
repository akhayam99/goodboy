import { brandId, type WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';
import { workspaceTabCount } from './workspaceTabCount';

type Params = {
  readonly state: AppState;
  readonly patch: Partial<AppState>;
};

export const keepTabCounts = ({ state, patch }: Params): Partial<AppState> => {
  const isTabWrite =
    'browserSessionTabs' in patch || 'browserProjectPins' in patch || 'browserTabCounts' in patch;
  if (!isTabWrite) {
    return patch;
  }
  const merged = { ...state, ...patch };
  const counts = Object.fromEntries(
    Object.keys(merged.browserTabCounts).map((id) => [
      id,
      workspaceTabCount({ state: merged, workspaceId: brandId<WorkspaceId>({ value: id }) }),
    ]),
  );
  return { ...patch, browserTabCounts: counts };
};
