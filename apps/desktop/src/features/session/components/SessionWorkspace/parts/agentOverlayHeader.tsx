import type { ReactNode } from 'react';
import { Divider } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import type { AgentHomeLens } from '../../../agent-kind';
import type { ResolverStatus } from '../../../resolver-linkage';
import { ForceResolveAction } from '../../ForceResolveAction';
import { ChatWorkflowContext } from './ChatWorkflowContext';
import { ChatWorkflowHeader } from './ChatWorkflowHeader';

type Params = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly selectedAgent: Agent | null;
  readonly overlayHome: AgentHomeLens;
  readonly showWorkflowStrip: boolean;
  readonly workflowName: string | null;
  readonly showForceResolve: boolean;
  readonly resolverStatus: ResolverStatus | null;
  readonly onOpenWorkflow: () => void;
};

export const agentOverlayHeader = ({
  session,
  sessionId,
  selectedAgentId,
  selectedAgent,
  overlayHome,
  showWorkflowStrip,
  workflowName,
  showForceResolve,
  resolverStatus,
  onOpenWorkflow,
}: Params): ReactNode | undefined => {
  if (showWorkflowStrip && selectedAgentId != null) {
    return (
      <ChatWorkflowHeader
        sessionId={sessionId}
        session={session}
        selectedAgentId={selectedAgentId}
      />
    );
  }
  if (overlayHome !== 'workflows' && workflowName != null) {
    return <ChatWorkflowContext workflowName={workflowName} onOpenWorkflow={onOpenWorkflow} />;
  }
  if (showForceResolve && selectedAgent != null && resolverStatus != null) {
    return (
      <>
        <div className="flex h-[var(--chat-header-h)] shrink-0 items-center justify-end px-3">
          <ForceResolveAction agent={selectedAgent} sessionId={sessionId} status={resolverStatus} />
        </div>
        <Divider className="shrink-0" />
      </>
    );
  }
  return undefined;
};
