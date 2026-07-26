import type { ReactNode } from 'react';
import { Divider } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import type { AgentHomeLens } from '../../../agent-kind';
import type { ResolverStatus } from '../../../resolver-linkage';
import { ForceResolveAction } from '../../ForceResolveAction';
import { ChatHeaderBack } from './ChatHeaderBack';
import { ChatWorkflowHeader } from './ChatWorkflowHeader';

type Params = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly selectedAgent: Agent | null;
  readonly overlayHome: AgentHomeLens;
  readonly overlayHomeLabel: string;
  readonly showWorkflowStrip: boolean;
  readonly showForceResolve: boolean;
  readonly resolverStatus: ResolverStatus | null;
  readonly onBack: () => void;
  readonly onOpenWorkflow: () => void;
};

export const agentOverlayHeader = ({
  session,
  sessionId,
  selectedAgentId,
  selectedAgent,
  overlayHome,
  overlayHomeLabel,
  showWorkflowStrip,
  showForceResolve,
  resolverStatus,
  onBack,
  onOpenWorkflow,
}: Params): ReactNode | undefined => {
  if (showWorkflowStrip && selectedAgentId != null) {
    return (
      <ChatWorkflowHeader
        sessionId={sessionId}
        session={session}
        selectedAgentId={selectedAgentId}
        onOpenWorkflow={onOpenWorkflow}
      />
    );
  }
  return (
    <>
      <div className="flex h-[var(--chat-header-h)] shrink-0 items-center justify-between gap-2 px-3">
        <ChatHeaderBack label={overlayHomeLabel} onClick={onBack} />
        {showForceResolve && selectedAgent != null && resolverStatus != null ? (
          <ForceResolveAction agent={selectedAgent} sessionId={sessionId} status={resolverStatus} />
        ) : null}
      </div>
      <Divider className="shrink-0" />
    </>
  );
};
