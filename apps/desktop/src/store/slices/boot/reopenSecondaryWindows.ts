import { spawnWorkspaceWindow } from '../../../features/workspace/window';
import type { LaunchLayout } from './restoreLaunchLayout';

type Params = {
  readonly layouts: LaunchLayout['secondary'];
};

export const reopenSecondaryWindows = async ({ layouts }: Params): Promise<void> => {
  for (const layout of layouts) {
    try {
      await spawnWorkspaceWindow(layout.workspaceId, layout.title, { restoreKey: layout.label });
    } catch (error) {
      console.error('reopen window failed', error);
    }
  }
};
