import type { ProviderId, TaskModelPreference, WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { OrchestratorModelPickRow, TaskModelRow } from '../../../providers/defaultsPanelSurfaces';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly preference: TaskModelPreference | null;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly isDisabled: boolean;
  readonly onChange: (preference: TaskModelPreference | null) => void;
};

const HINT = 'Shown while a plan run from an earlier version is open.';

export const OlderPlanRunsBand = ({
  workspaceId,
  preference,
  connectedProviderIds,
  isDisabled,
  onChange,
}: Props) => (
  <Band label="Older plan runs" ariaLabel="Older plan runs" hint={HINT} headingLevel={2}>
    <TaskModelRow
      workspaceId={workspaceId}
      task="workflow_orchestrator"
      label="Orchestrator"
      help="Picks the next step in an older plan run."
      preference={preference}
      connectedProviderIds={connectedProviderIds}
      disabled={isDisabled}
      onChange={onChange}
    />
    <OrchestratorModelPickRow workspaceId={workspaceId} />
  </Band>
);
