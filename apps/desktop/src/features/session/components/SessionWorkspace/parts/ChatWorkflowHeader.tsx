import { useMemo } from 'react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { Divider, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../../../../../shared/components/paneRhythm';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { resolveRootAgent } from '../../../agent-kind';
import { ChatWorkflowAdvance } from './ChatWorkflowAdvance';
import { WorkflowBreadcrumb } from './WorkflowBreadcrumb';

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
      <div
        className={cn(
          'flex h-[var(--chat-header-h)] shrink-0 items-center gap-3',
          PANE_RHYTHM.inset,
        )}
      >
        <WorkflowBreadcrumb
          sessionId={sessionId}
          session={session}
          selectedAgentId={selectedAgentId}
          homeLabel={attached == null ? 'Workflows' : workflowKindName(attached.workflow)}
          onHome={onOpenWorkflow}
        />
        {attached != null && attached.run.discardedAt == null ? (
          <ChatWorkflowAdvance
            sessionId={sessionId}
            run={attached.run}
            workflow={attached.workflow}
          />
        ) : null}
      </div>
      <Divider className="shrink-0" />
    </>
  );
};
