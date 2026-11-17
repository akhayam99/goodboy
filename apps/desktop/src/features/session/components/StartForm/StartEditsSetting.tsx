import type { ClaudePermissionMode, ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import type { PickerMode } from '../../../permissions/modeCopy';
import { StartEditsChip } from './StartEditsChip';
import { useStartEditsMode } from './useStartEditsMode';

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
  const { mode, workspaceMode, workspaceName } = useStartEditsMode({
    workspaceId,
    sessionId,
    picked,
  });
  return (
    <StartEditsChip
      value={mode}
      workspaceMode={workspaceMode}
      workspaceName={workspaceName}
      provider={provider}
      isDisabled={isDisabled}
      onPick={onPick}
    />
  );
};
