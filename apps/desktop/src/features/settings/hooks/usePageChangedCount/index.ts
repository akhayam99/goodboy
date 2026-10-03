import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { pageKeys } from '../../pageKeys';
import { fieldDef, isChanged } from '../../workspaceSettings/fields';
import { workspaceSettingsSnapshot } from '../../workspaceSettings/snapshot';
import type { WorkspacePage } from '../../components/SettingsStudio/workspacePages';

export const usePageChangedCount = ({
  workspaceId,
  page,
}: {
  readonly workspaceId: WorkspaceId;
  readonly page: WorkspacePage;
}): number =>
  useAppStore((state) => {
    const snapshot = workspaceSettingsSnapshot({ state, workspaceId });
    return pageKeys({ page }).filter((field) => isChanged({ def: fieldDef({ field }), snapshot }))
      .length;
  });
