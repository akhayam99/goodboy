import type { WorkspaceId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import type { ToolUseCounts } from './toolUses';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly counts: ToolUseCounts;
};

export const noteToolUseCounts = ({ set, get }: SliceDeps) => {
  return ({ workspaceId, counts }: Params): void => {
    const held = get().toolUseCounts[workspaceId];
    if (held !== undefined && JSON.stringify(held) === JSON.stringify(counts)) {
      return;
    }
    set((state) => ({ toolUseCounts: { ...state.toolUseCounts, [workspaceId]: counts } }));
  };
};
