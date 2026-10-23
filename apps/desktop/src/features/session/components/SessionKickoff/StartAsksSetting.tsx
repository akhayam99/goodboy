import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { AsksYouChip } from '../../../workflows/AsksYouChip';
import { asksWordsOf } from '../../../workflows/asksWordsOf';
import { runAutonomyOf } from '../../../workflows/runAutonomy';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
};

const HELP = 'When the run stops and waits for your go.';

export const StartAsksSetting = ({ workspaceId, isDisabled }: Props) => {
  const autonomy = useAppStore((state) => selectSessionDraft({ state, workspaceId }).autonomy);
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const workspaceAutonomy = useAppStore(
    (state) =>
      state.workspaceOverrides?.[workspaceId]?.workflowRules?.autonomy ??
      DEFAULT_WORKFLOW_RULES.autonomy,
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const own = runAutonomyOf({ autoRun: false, autonomy });
  return (
    <AsksYouChip
      value={own.key}
      words={asksWordsOf({ own, workspaceName, workspaceAutonomy })}
      help={HELP}
      error={null}
      isDisabled={isDisabled}
      onPick={({ next }) => patchSessionDraft({ workspaceId, patch: { autonomy: next } })}
    />
  );
};
