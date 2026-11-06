import { useCallback, useState } from 'react';
import type { MountId, WorkspaceId } from '@goodboy/types';
import { readCollapsedGroups, writeCollapsedGroups } from '../../../groupsCollapsedStorage';
import {
  readPackagesCollapsedOverrides,
  writePackagesCollapsedOverrides,
} from '../../../packagesCollapsedStorage';
import { packageSectionKey } from '../packageSectionKey';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type GroupParams = {
  readonly mountId: MountId;
  readonly isCollapsed: boolean;
};

type PackageParams = GroupParams & {
  readonly sectionKey: string;
};

export const useScriptCollapse = ({ workspaceId }: Params) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<MountId>>(() =>
    readCollapsedGroups({ workspaceId }),
  );
  const [packagesOverrides, setPackagesOverrides] = useState<Readonly<Record<string, boolean>>>(
    () => readPackagesCollapsedOverrides({ workspaceId }),
  );

  const setGroupCollapsed = useCallback(
    ({ mountId, isCollapsed }: GroupParams) => {
      setCollapsed((current) => {
        const next = isCollapsed
          ? new Set(current).add(mountId)
          : new Set([...current].filter((id) => id !== mountId));
        writeCollapsedGroups({ workspaceId, collapsed: next });
        return next;
      });
    },
    [workspaceId],
  );

  const setPackageCollapsed = useCallback(
    ({ mountId, sectionKey, isCollapsed }: PackageParams) => {
      setPackagesOverrides((current) => {
        const next = { ...current, [packageSectionKey({ mountId, sectionKey })]: isCollapsed };
        writePackagesCollapsedOverrides({ workspaceId, overrides: next });
        return next;
      });
    },
    [workspaceId],
  );

  return { collapsed, packagesOverrides, setGroupCollapsed, setPackageCollapsed };
};
