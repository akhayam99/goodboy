import type { AgentId, Session, SessionId } from '@goodboy/types';
import { Divider } from '@goodboy/ui';
import { WorkflowStepper } from './WorkflowStepper';

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session;
  readonly selectedAgentId: AgentId;
};

export const ChatWorkflowHeader = ({ sessionId, session, selectedAgentId }: Props) => (
  <>
    <div className="flex h-[var(--chat-header-h)] shrink-0 items-center px-3">
      <WorkflowStepper sessionId={sessionId} session={session} selectedAgentId={selectedAgentId} />
    </div>
    <Divider className="shrink-0" />
  </>
);
