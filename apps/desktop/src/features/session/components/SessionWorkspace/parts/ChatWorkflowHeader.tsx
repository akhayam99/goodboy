import { useMemo } from 'react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { Divider } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { resolveRootAgent } from '../../../agent-kind';
import { AgentBreadcrumb } from './AgentBreadcrumb';
import { ChatWorkflowAdvance } from './ChatWorkflowAdvance';
import { WorkflowStepper } from './WorkflowStepper';

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session;
  readonly selectedAgentId: AgentId;
  readonly onOpenWorkflow: () => void;
};

export const ChatWorkflowHeader = ({
  sessionId,
  session,
  selectedAgentId,
  onOpenWorkflow,
}: Props) => {
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const rootAgent = useMemo(
    () => resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId }),
    [phaseRuns, selectedAgentId],
  );
  const attached = attachedRuns.find(({ run }) => run.id === rootAgent?.workflowRunId) ?? null;

  return (
    <>
      <div className="flex h-[var(--chat-header-h)] shrink-0 items-center gap-2 px-3">
        <AgentBreadcrumb
          sessionId={sessionId}
          selectedAgentId={selectedAgentId}
          overlayHome="workflows"
          homeLabel={attached == null ? 'Workflows' : workflowKindName(attached.workflow)}
          onHome={onOpenWorkflow}
        />
        <Divider orientation="vertical" className="h-4 shrink-0" />
        <WorkflowStepper
          sessionId={sessionId}
          session={session}
          selectedAgentId={selectedAgentId}
        />
      </div>
      {attached != null && attached.run.discardedAt == null ? (
        <ChatWorkflowAdvance
          sessionId={sessionId}
          workflowRunId={attached.run.id}
          workflow={attached.workflow}
        />
      ) : null}
      <Divider className="shrink-0" />
    </>
  );
};
