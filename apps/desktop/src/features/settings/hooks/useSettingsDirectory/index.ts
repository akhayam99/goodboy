import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import {
  settingsDirectory,
  type SettingsGroup,
} from '../../components/SettingsStudio/settingsDirectory';
import { useSettingsStatus } from '../useSettingsStatus';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly workspaceName: string | null;
};

export const useSettingsDirectory = ({
  workspaceId,
  workspaceName,
}: Params): ReadonlyArray<SettingsGroup> => {
  const status = useSettingsStatus({ workspaceId });
  return useMemo(() => settingsDirectory({ status, workspaceName }), [status, workspaceName]);
};
