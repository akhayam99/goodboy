import { memo } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { IconButton, InteractiveRow, StatusDot, cn } from '@goodboy/ui';
import type { ChatId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';

type Props = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly snippet: string;
  readonly time: string;
  readonly isIdle: boolean;
  readonly isPinned: boolean;
  readonly isSelected: boolean;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onPin: (params: { readonly chatId: ChatId; readonly isPinned: boolean }) => void;
  readonly onArchive: (chatId: ChatId) => void;
};

const ChatListRowView = ({
  chatId,
  title,
  snippet,
  time,
  isIdle,
  isPinned,
  isSelected,
  onSelect,
  onPin,
  onArchive,
}: Props) => {
  const isStreaming = useAppStore((state) => state.chatStreams[chatId] !== undefined);
  const isUnread = useAppStore((state) => state.unreadChatIds.includes(chatId));
  return (
    <li data-chat-row={chatId} data-idle={isIdle ? 'true' : undefined}>
      <InteractiveRow
        label={title}
        isSelected={isSelected}
        onOpen={() => onSelect(chatId)}
        frameClassName="group"
        className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-label group-hover:pr-12 group-focus-within:pr-12',
              isIdle && !isSelected ? 'text-faint-foreground' : 'text-foreground',
            )}
          >
            {title}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-meta text-faint-foreground group-hover:invisible group-focus-within:invisible">
            {isStreaming ? (
              <StatusDot tone="primary" size="sm" pulsing ariaLabel="Answering" />
            ) : null}
            {!isStreaming && isUnread ? (
              <StatusDot tone="primary" size="sm" ariaLabel="New reply" />
            ) : null}
            {time}
          </span>
        </span>
        <span
          className={cn(
            'truncate text-secondary',
            isIdle ? 'text-disabled-foreground' : 'text-faint-foreground',
          )}
        >
          {snippet}
        </span>
        <span className="absolute right-0 top-0 flex items-center opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <IconButton
            icon={isPinned ? PinOff : Pin}
            label={isPinned ? `Unpin ${title}` : `Pin ${title}`}
            tooltip={isPinned ? 'Unpin' : 'Pin'}
            variant="ghost"
            iconSize={12}
            onClick={() => onPin({ chatId, isPinned: !isPinned })}
          />
          <IconButton
            icon={CONCEPT_ICONS.archive}
            label={`Archive ${title}`}
            tooltip="Archive"
            variant="ghost"
            iconSize={12}
            onClick={() => onArchive(chatId)}
          />
        </span>
      </InteractiveRow>
    </li>
  );
};

export const ChatListRow = memo(ChatListRowView);
