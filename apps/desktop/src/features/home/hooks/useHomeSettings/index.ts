import { useAppStore } from '../../../../store';
import { workspaceSettingsSnapshot } from '../../../settings/workspaceSettings/snapshot';
import type { WorkspaceSettingsSnapshot } from '../../../settings/workspaceSettings/snapshot';
import type { WorkspaceId } from '@goodboy/types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useHomeSettings = ({ workspaceId }: Params): WorkspaceSettingsSnapshot =>
  useAppStore((state) => workspaceSettingsSnapshot({ state, workspaceId }));
