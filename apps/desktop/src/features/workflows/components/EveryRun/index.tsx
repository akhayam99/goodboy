import type { WorkspaceId } from '@goodboy/types';
import { WorkflowRulesPanel } from '../WorkflowRulesPanel';
import { ReplyLengthBand } from '../WorkflowRulesPanel/ReplyLengthBand';
import { RunsAdvancedBand } from '../../../settings/workspaceFieldSurfaces';
import { EveryRunModels } from './EveryRunModels';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const EveryRun = ({ workspaceId }: Props) => (
  <WorkflowRulesPanel
    workspaceId={workspaceId}
    advanced={<RunsAdvancedBand workspaceId={workspaceId} />}
  >
    <ReplyLengthBand workspaceId={workspaceId} />
    <EveryRunModels workspaceId={workspaceId} />
  </WorkflowRulesPanel>
);
