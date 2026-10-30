import { DEFAULT_WORKFLOW_RULES, type WorkflowAutonomy, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AsksYouChip } from '../../../workflows/AsksYouChip';
import { asksWordsOf } from '../../../workflows/asksWordsOf';
import { runAutonomyOf } from '../../../workflows/runAutonomy';

type PickParams = {
  readonly next: WorkflowAutonomy;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly autonomy: WorkflowAutonomy;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

const HELP = 'When the run stops and waits for your go.';

export const StartAsksSetting = ({ workspaceId, autonomy, isDisabled, onPick }: Props) => {
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const workspaceAutonomy = useAppStore(
    (state) =>
      state.workspaceOverrides?.[workspaceId]?.workflowRules?.autonomy ??
      DEFAULT_WORKFLOW_RULES.autonomy,
  );
  const own = runAutonomyOf({ autoRun: false, autonomy });
  return (
    <AsksYouChip
      value={own.key}
      words={asksWordsOf({ own, workspaceName, workspaceAutonomy })}
      help={HELP}
      error={null}
      isDisabled={isDisabled}
      onPick={onPick}
    />
  );
};
