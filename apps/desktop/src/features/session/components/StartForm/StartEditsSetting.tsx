import type { ClaudePermissionMode, ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import {
  DEFAULT_PERMISSION_MODE,
  pickerModeOf,
  type PickerMode,
} from '../../../permissions/modeCopy';
import { StartEditsChip } from './StartEditsChip';

type PickParams = {
  readonly next: PickerMode;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly picked: ClaudePermissionMode | null;
  readonly provider: ProviderId | null;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

export const StartEditsSetting = ({
  workspaceId,
  sessionId,
  picked,
  provider,
  isDisabled,
  onPick,
}: Props) => {
  const workspace = useAppStore((state) =>
    state.workspaces.find((candidate) => candidate.id === workspaceId),
  );
  const sessionMode = useAppStore((state) =>
    sessionId === null ? null : (sessionById(state.sessions, sessionId)?.permissionMode ?? null),
  );
  const workspaceMode = pickerModeOf({
    mode: workspace?.defaultPermissionMode ?? DEFAULT_PERMISSION_MODE,
  });
  return (
    <StartEditsChip
      value={pickerModeOf({ mode: picked ?? sessionMode ?? workspaceMode })}
      workspaceMode={workspaceMode}
      workspaceName={workspace?.name ?? 'the workspace'}
      provider={provider}
      isDisabled={isDisabled}
      onPick={onPick}
    />
  );
};
