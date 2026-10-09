import { StatusDot, TOP_BAR_CONTROL, Tooltip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isOnChat: boolean;
  readonly runningCount: number;
  readonly hasUnread: boolean;
  readonly onChat: () => void;
};

const ChatIcon = CONCEPT_ICONS.chat;

const DOT_CORNER = 'absolute -right-1 -top-0.5';

type TipParams = {
  readonly runningCount: number;
  readonly hasUnread: boolean;
};

const tipOf = ({ runningCount, hasUnread }: TipParams): string => {
  if (runningCount > 0) {
    return runningCount === 1 ? '1 chat running' : `${runningCount} chats running`;
  }
  return hasUnread ? 'New reply' : 'Chat';
};

export const ChatButton = ({ isOnChat, runningCount, hasUnread, onChat }: Props) => {
  const tip = tipOf({ runningCount, hasUnread });
  return (
    <Tooltip content={tip} side="bottom">
      <button
        type="button"
        aria-current={isOnChat ? 'page' : undefined}
        aria-disabled={isOnChat ? true : undefined}
        aria-label="Chat"
        data-nav-chat=""
        data-chat-activity={runningCount > 0 ? 'running' : hasUnread ? 'unread' : undefined}
        onClick={() => {
          if (isOnChat) {
            return;
          }
          onChat();
        }}
        className={cn(
          TOP_BAR_CONTROL.height,
          TOP_BAR_CONTROL.radius,
          'flex shrink-0 items-center gap-2 px-2 text-label motion-safe:transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          isOnChat
            ? 'cursor-default bg-overlay-selected text-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )}
      >
        <span className="relative flex shrink-0">
          <ChatIcon size={ICON_SIZE.control} aria-hidden />
          {runningCount > 0 ? (
            <StatusDot tone="info" size="md" pulsing className={DOT_CORNER} />
          ) : null}
          {runningCount === 0 && hasUnread ? (
            <StatusDot tone="warning" size="md" className={DOT_CORNER} />
          ) : null}
        </span>
        Chat
      </button>
    </Tooltip>
  );
};
