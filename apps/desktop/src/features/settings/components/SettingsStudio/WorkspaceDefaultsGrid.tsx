import type { WorkspaceId } from '@goodboy/types';
import { WorkflowRulesPanel } from '../../../workflows/workflowRulesPanel';
import { ReplyLengthBand } from '../../../workflows/replyLengthBand';
import { RunsAdvancedBand } from './RunsAdvancedBand';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceDefaultsGrid = ({ workspaceId }: Props) => (
  <WorkflowRulesPanel
    workspaceId={workspaceId}
    advanced={<RunsAdvancedBand workspaceId={workspaceId} />}
  >
    <ReplyLengthBand workspaceId={workspaceId} />
  </WorkflowRulesPanel>
);
