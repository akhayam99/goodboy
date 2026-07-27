import type { ReactNode } from 'react';
import { Divider } from '@goodboy/ui';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import type { AgentHomeLens } from '../../../agent-kind';
import { AgentBreadcrumb } from './AgentBreadcrumb';
import { ChatWorkflowHeader } from './ChatWorkflowHeader';

type Params = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly overlayHome: AgentHomeLens;
  readonly overlayHomeLabel: string;
  readonly showWorkflowStrip: boolean;
  readonly onBack: () => void;
  readonly onOpenWorkflow: () => void;
};

export const agentOverlayHeader = ({
  session,
  sessionId,
  selectedAgentId,
  overlayHome,
  overlayHomeLabel,
  showWorkflowStrip,
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
      <div className="flex h-[var(--chat-header-h)] shrink-0 items-center gap-2 px-3">
        <AgentBreadcrumb
          sessionId={sessionId}
          selectedAgentId={selectedAgentId}
          overlayHome={overlayHome}
          homeLabel={overlayHomeLabel}
          onHome={onBack}
        />
      </div>
      <Divider className="shrink-0" />
    </>
  );
};
