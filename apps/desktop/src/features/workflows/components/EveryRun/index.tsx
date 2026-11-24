import type { WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { WorkflowRulesPanel } from '../WorkflowRulesPanel';
import { ReplyLengthBand } from '../WorkflowRulesPanel/ReplyLengthBand';
import { RunsAdvancedBand, WorkspaceFieldRow } from '../../../settings/workspaceFieldSurfaces';
import { DefaultModeCards } from '../../../permissions/permissionDefaultSurfaces';
import { EveryRunModels } from './EveryRunModels';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const EveryRun = ({ workspaceId }: Props) => (
  <WorkflowRulesPanel
    workspaceId={workspaceId}
    advanced={<RunsAdvancedBand workspaceId={workspaceId} />}
  >
    <Band inset="content" label="Edits" ariaLabel="Edits" headingLevel={2}>
      <WorkspaceFieldRow workspaceId={workspaceId} field="permissionMode" layout="stacked">
        <DefaultModeCards workspaceId={workspaceId} />
      </WorkspaceFieldRow>
    </Band>
    <ReplyLengthBand workspaceId={workspaceId} />
    <EveryRunModels workspaceId={workspaceId} />
  </WorkflowRulesPanel>
);
