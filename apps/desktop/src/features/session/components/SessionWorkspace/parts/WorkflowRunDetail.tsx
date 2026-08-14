import type { Session, WorkflowRunId } from '@goodboy/types';
import { ScrollFade, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';

type Props = {
  readonly session: Session;
  readonly workflowRunId: WorkflowRunId;
};

export const WorkflowRunDetail = ({ session, workflowRunId }: Props) => (
  <ScrollFade className="h-full min-w-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
    <div
      className={cn(
        'flex flex-col motion-safe:animate-studio-in',
        PANE_RHYTHM.column,
        PANE_RHYTHM.stack,
        PANE_RHYTHM.measure.pane,
      )}
    >
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
