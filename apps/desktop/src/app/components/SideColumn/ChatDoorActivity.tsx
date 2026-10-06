import { StatusDot } from '@goodboy/ui';
import { useChatActivity } from '../../../features/workspace-chat/hooks/useChatActivity';

export const ChatDoorActivity = () => {
  const { runningCount, hasUnread } = useChatActivity();
  if (runningCount > 0) {
    return (
      <span aria-hidden data-chat-activity="running" className="flex shrink-0">
        <StatusDot tone="info" size="md" pulsing />
      </span>
    );
  }
  if (!hasUnread) {
    return null;
  }
  return (
    <span aria-hidden data-chat-activity="unread" className="flex shrink-0">
      <StatusDot tone="primary" size="sm" />
    </span>
  );
};
