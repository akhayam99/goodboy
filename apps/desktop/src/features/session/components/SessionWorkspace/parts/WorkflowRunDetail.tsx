import { useState } from 'react';
import type { AgentId, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { WorkflowStepInspector } from '../../../../workflows/components/WorkflowStepInspector';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { InspectorSplit } from './InspectorSplit';

type Props = {
  readonly session: Session;
  readonly workflowRunId: WorkflowRunId;
};

export const WorkflowRunDetail = ({ session, workflowRunId }: Props) => {
  const [inspectedStepId, setInspectedStepId] = useState<AgentId | null>(null);
  const selectAgent = useAppStore((state) => state.selectAgent);

  return (
    <InspectorSplit
      open={inspectedStepId !== null}
      panel={
        inspectedStepId !== null ? (
          <WorkflowStepInspector
            session={session}
            agentId={inspectedStepId}
            onClose={() => setInspectedStepId(null)}
            onOpenChat={() => void selectAgent(session.id as SessionId, inspectedStepId)}
          />
        ) : null
      }
    >
      <ScrollFade className="h-full min-w-0" viewportClassName="px-6 py-5" fadeSize={24}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 motion-safe:animate-studio-in">
          <AgentsSection
            task={session}
            only="workflows"
            workflowRunId={workflowRunId}
            workflowVariant="detail"
            showWorkflowAttach={false}
            inspectedStepId={inspectedStepId}
            onInspectStep={setInspectedStepId}
          />
        </div>
      </ScrollFade>
    </InspectorSplit>
  );
};
