import type { ClaudePermissionMode, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import {
  DEFAULT_PERMISSION_MODE,
  pickerModeOf,
  type PickerMode,
} from '../../../../permissions/modeCopy';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly picked: ClaudePermissionMode | null;
};

type StartEditsMode = {
  readonly mode: PickerMode;
  readonly workspaceMode: PickerMode;
  readonly workspaceName: string;
};

export const useStartEditsMode = ({ workspaceId, sessionId, picked }: Params): StartEditsMode => {
  const workspace = useAppStore((state) =>
    state.workspaces.find((candidate) => candidate.id === workspaceId),
  );
  const sessionMode = useAppStore((state) =>
    sessionId === null ? null : (sessionById(state.sessions, sessionId)?.permissionMode ?? null),
  );
  const workspaceMode = pickerModeOf({
    mode: workspace?.defaultPermissionMode ?? DEFAULT_PERMISSION_MODE,
  });
  return {
    mode: pickerModeOf({ mode: picked ?? sessionMode ?? workspaceMode }),
    workspaceMode,
    workspaceName: workspace?.name ?? 'the workspace',
  };
};
