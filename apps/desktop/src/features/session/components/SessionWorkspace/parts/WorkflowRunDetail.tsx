import type { Session, WorkflowRunId } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';

type Props = {
  readonly session: Session;
  readonly workflowRunId: WorkflowRunId;
};

export const WorkflowRunDetail = ({ session, workflowRunId }: Props) => (
  <ScrollFade className="h-full min-w-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 motion-safe:animate-studio-in">
      <AgentsSection
        task={session}
        only="workflows"
        workflowRunId={workflowRunId}
        workflowVariant="detail"
        showWorkflowAttach={false}
      />
    </div>
  </ScrollFade>
);
