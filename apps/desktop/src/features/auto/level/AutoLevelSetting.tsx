import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { AsksYouChip } from '../../workflows/AsksYouChip';
import { asksWordsOf } from '../../workflows/asksWordsOf';
import { runAutonomyOf } from '../../workflows/runAutonomy';
import { useAutoLevel } from '../../../shared/hooks/useAutoLevel';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

const HELP =
  'How much Auto may do alone. A change applies to what Auto starts next; an agent already waiting for your go keeps waiting.';

export const AutoLevelSetting = ({ sessionId, workspaceId }: Props) => {
  const { level, workspaceLevel, error, pick } = useAutoLevel({ workspaceId, sessionId });
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const own = runAutonomyOf({ autoRun: false, autonomy: level });
  return (
    <AsksYouChip
      value={own.key}
      words={asksWordsOf({ own, workspaceName, workspaceAutonomy: workspaceLevel })}
      help={HELP}
      error={error}
      isDisabled={false}
      onPick={({ next }) => void pick({ next })}
    />
  );
};
