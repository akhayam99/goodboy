import type { SessionId } from '@goodboy/types';
import { ChatView } from '../../../features/chat/components/ChatView';
import { ContextPanel } from '../../../features/context/components/ContextPanel';
import { useSessionById } from '../../../store';

type KeepAliveChatPanelProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
};

export function KeepAliveChatPanel({ sessionId, isActive }: KeepAliveChatPanelProps) {
  const session = useSessionById(sessionId);
  if (!session) {
    return null;
  }
  return (
    <div hidden={!isActive} className="absolute inset-0">
      <ChatView session={session} isActive={isActive} />
    </div>
  );
}

type KeepAliveContextPanelProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
};

export function KeepAliveContextPanel({
  sessionId,
  isActive,
  collapsed,
  onCollapse,
  onExpand,
}: KeepAliveContextPanelProps) {
  const session = useSessionById(sessionId);
  if (!session) {
    return null;
  }
  return (
    <div hidden={!isActive} className="absolute inset-0">
      <ContextPanel
        session={session}
        isActive={isActive}
        collapsed={collapsed}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    </div>
  );
}
