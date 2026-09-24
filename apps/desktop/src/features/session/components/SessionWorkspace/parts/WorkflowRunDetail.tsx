import type { Session, WorkflowRunId } from '@goodboy/types';
import { AgentsSection } from '../../AgentTree/AgentsSection';

type Props = {
  readonly session: Session;
  readonly workflowRunId: WorkflowRunId;
};

export const WorkflowRunDetail = ({ session, workflowRunId }: Props) => (
  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <AgentsSection
      task={session}
      only="workflows"
      workflowRunId={workflowRunId}
      showWorkflowAttach={false}
    />
  </div>
);
