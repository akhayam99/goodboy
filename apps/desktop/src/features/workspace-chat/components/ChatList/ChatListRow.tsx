import { memo, useMemo, useState } from 'react';
import { Ellipsis, Pin, PinOff } from 'lucide-react';
import { IconButton, InteractiveRow, StatusDot, cn } from '@goodboy/ui';
import type { ChatId, ChatModelUsed } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { chatObjectKey } from '../../../actions/kinds/chat';
import type { ObjectTarget } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { useChatSessionMarker } from '../../hooks/useChatSessionMarker';
import { ChatModelGlyphs } from './ChatModelGlyphs';
import { ChatRenameInput } from './ChatRenameInput';
import { ChatSessionMark } from './ChatSessionMark';

type Props = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly snippet: string;
  readonly time: string;
  readonly isIdle: boolean;
  readonly isPinned: boolean;
  readonly models: ReadonlyArray<ChatModelUsed>;
  readonly isSelected: boolean;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onPin: (params: { readonly chatId: ChatId; readonly isPinned: boolean }) => void;
  readonly onArchive: (chatId: ChatId) => void;
  readonly onDelete: (chatId: ChatId) => Promise<void>;
};

const ChatListRowView = ({
  chatId,
  title,
  snippet,
  time,
  isIdle,
  isPinned,
  models,
  isSelected,
  onSelect,
  onPin,
  onArchive,
  onDelete,
}: Props) => {
  const isStreaming = useAppStore((state) => state.chatStreams[chatId] !== undefined);
  const isUnread = useAppStore((state) => state.unreadChatIds.includes(chatId));
  const renameChat = useAppStore((state) => state.renameChat);
  const markChatUnread = useAppStore((state) => state.markChatUnread);
  const markChatRead = useAppStore((state) => state.markChatRead);
  const navigate = useAppStore((state) => state.navigate);
  const marker = useChatSessionMarker({ chatId });
  const [isRenaming, setIsRenaming] = useState(false);
  const anchorKey = `chat-row:${chatId}`;

  useRenameRequest({
    objectKey: chatObjectKey({ chatId }),
    anchorKeys: [anchorKey],
    onRename: () => setIsRenaming(true),
  });

  const target = useMemo<ObjectTarget>(
    () => ({
      kind: 'chat',
      facts: {
        chatId,
        title,
        isPinned,
        isUnread,
        onToggleUnread: () => (isUnread ? markChatRead({ chatId }) : markChatUnread({ chatId })),
        onTogglePin: () => onPin({ chatId, isPinned: !isPinned }),
        onArchive: () => onArchive(chatId),
        onDelete: () => onDelete(chatId),
      },
    }),
    [chatId, title, isPinned, isUnread, markChatRead, markChatUnread, onPin, onArchive, onDelete],
  );
  const menu = useObjectMenuTrigger({ target, anchorKey });

  return (
    <li data-chat-row={chatId} data-idle={isIdle ? 'true' : undefined}>
      <InteractiveRow
        label={title}
        isSelected={isSelected}
        onOpen={() => onSelect(chatId)}
        frameClassName="group"
        className="flex min-w-0 flex-col gap-0.5 py-1.5 pl-4 pr-2"
        menu={menu}
      >
        <span className="relative flex min-w-0 items-center gap-2">
          {isStreaming ? (
            <StatusDot
              tone="info"
              pulsing
              ariaLabel="Answering"
              className="absolute -left-3 top-1/2 -translate-y-1/2"
            />
          ) : null}
          {!isStreaming && isUnread ? (
            <StatusDot
              tone="warning"
              ariaLabel="New reply"
              className="absolute -left-3 top-1/2 -translate-y-1/2"
            />
          ) : null}
          {isRenaming ? (
            <ChatRenameInput
              title={title}
              onCommit={(next) => {
                setIsRenaming(false);
                void renameChat({ chatId, title: next });
              }}
              onCancel={() => setIsRenaming(false)}
            />
          ) : (
            <>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-label group-hover:pr-12 group-focus-within:pr-12',
                  isIdle && !isSelected ? 'text-faint-foreground' : 'text-foreground',
                )}
              >
                {title}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-meta text-faint-foreground group-hover:invisible group-focus-within:invisible">
                <ChatModelGlyphs models={models} />
                {time}
              </span>
            </>
          )}
        </span>
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5 text-secondary',
            isIdle ? 'text-disabled-foreground' : 'text-faint-foreground',
          )}
        >
          {isRenaming ? (
            <span className="truncate">Enter saves · Esc cancels</span>
          ) : (
            <>
              {marker === null ? null : (
                <ChatSessionMark
                  marker={marker}
                  onOpen={(sessionId) => navigate({ to: sessionPlace({ sessionId }) })}
                />
              )}
              <span className="min-w-0 truncate">{snippet}</span>
            </>
          )}
        </span>
        {isRenaming ? null : (
          <span className="absolute right-0 top-0 flex items-center opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
            <IconButton
              icon={isPinned ? PinOff : Pin}
              label={isPinned ? `Unpin ${title}` : `Pin ${title}`}
              tooltip={isPinned ? 'Unpin' : 'Pin'}
              variant="ghost"
              iconSize={12}
              onClick={() => onPin({ chatId, isPinned: !isPinned })}
            />
            <ObjectOverflowMenu
              target={target}
              label={`More actions for ${title}`}
              tooltip="More"
              anchorKey={anchorKey}
              trigger={<Ellipsis size={ICON_SIZE.row} aria-hidden />}
              triggerClassName="p-1.5"
            />
          </span>
        )}
      </InteractiveRow>
    </li>
  );
};

export const ChatListRow = memo(ChatListRowView);
