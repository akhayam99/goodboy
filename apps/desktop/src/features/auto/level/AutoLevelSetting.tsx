import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAutoLevel } from '../../../shared/hooks/useAutoLevel';
import { AutoLevelChip } from './AutoLevelChip';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly treeId: AutoTreeId | null;
};

export const AutoLevelSetting = ({ sessionId, workspaceId, treeId }: Props) => {
  const { level, workspaceLevel, error, pick } = useAutoLevel({ workspaceId, sessionId });
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  return (
    <AutoLevelChip
      value={level}
      workspaceLevel={workspaceLevel}
      workspaceName={workspaceName}
      error={error}
      isDisabled={false}
      permissions={{ workspaceId, sessionId, treeId }}
      onPick={({ next }) => void pick({ next })}
    />
  );
};
