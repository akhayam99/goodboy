import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { overrideKeyOfField, type WorkspaceSettingField } from '../../pageKeys';
import { countFoldersWithOwn } from '../../settingLevel/countFoldersWithOwn';
import { foldersWithOwnLabel } from '../../settingLevel/foldersWithOwnLabel';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly field: WorkspaceSettingField;
};

export const useFoldersWithOwn = ({ workspaceId, field }: Params): string | null => {
  const key = overrideKeyOfField({ field });
  const count = useAppStore((state) =>
    key === null ? 0 : countFoldersWithOwn({ projects: state.projects, workspaceId, key }),
  );
  return foldersWithOwnLabel({ count });
};
