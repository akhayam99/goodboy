import { Tooltip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isOnChat: boolean;
  readonly onChat: () => void;
};

const ChatIcon = CONCEPT_ICONS.chat;

export const ChatButton = ({ isOnChat, onChat }: Props) => (
  <Tooltip content={isOnChat ? "You're in Chat" : 'Ask about this workspace'} side="bottom">
    <button
      type="button"
      aria-current={isOnChat ? 'page' : undefined}
      aria-disabled={isOnChat ? true : undefined}
      data-nav-chat=""
      onClick={() => {
        if (isOnChat) {
          return;
        }
        onChat();
      }}
      className={cn(
        'flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-label motion-safe:transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        isOnChat
          ? 'cursor-default bg-overlay-selected text-foreground'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      <ChatIcon size={ICON_SIZE.control} aria-hidden />
      Chat
    </button>
  </Tooltip>
);
