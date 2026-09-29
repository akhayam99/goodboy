import { memo, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Ellipsis, Pin, PinOff } from 'lucide-react';
import { ContextMenu, IconButton, InteractiveRow, StatusDot, cn } from '@goodboy/ui';
import type { MenuPoint } from '@goodboy/ui';
import type { ChatId, ChatModelUsed } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { isMenuKey } from '../../../actions/useObjectMenuTrigger';
import { useChatSessionMarker } from '../../hooks/useChatSessionMarker';
import { ChatDeleteConfirm } from './ChatDeleteConfirm';
import { ChatModelGlyphs } from './ChatModelGlyphs';
import { ChatRenameInput } from './ChatRenameInput';
import { ChatSessionMark } from './ChatSessionMark';
import { chatRowMenuEntries } from './chatRowMenuEntries';

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
  const marker = useChatSessionMarker({ chatId });
  const moreRef = useRef<HTMLSpanElement>(null);
  const [menuPoint, setMenuPoint] = useState<MenuPoint | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const entries = useMemo(
    () =>
      chatRowMenuEntries({
        isPinned,
        isUnread,
        onRename: () => setIsRenaming(true),
        onToggleUnread: () => (isUnread ? markChatRead({ chatId }) : markChatUnread({ chatId })),
        onTogglePin: () => onPin({ chatId, isPinned: !isPinned }),
        onArchive: () => onArchive(chatId),
        onDelete: () => setIsConfirming(true),
      }),
    [chatId, isPinned, isUnread, markChatRead, markChatUnread, onArchive, onPin],
  );

  const openAtPointer = (event: MouseEvent<HTMLElement>): void => {
    if (event.defaultPrevented || isRenaming) {
      return;
    }
    event.preventDefault();
    setMenuPoint({ x: event.clientX, y: event.clientY });
  };

  const openAtButton = (): void => {
    const rect = moreRef.current?.getBoundingClientRect();
    if (rect === undefined) {
      return;
    }
    setMenuPoint({ x: rect.left, y: rect.bottom + 4 });
  };

  if (isConfirming) {
    return (
      <li data-chat-row={chatId}>
        <ChatDeleteConfirm
          title={title}
          canArchive
          onDelete={() => onDelete(chatId)}
          onArchive={() => {
            setIsConfirming(false);
            onArchive(chatId);
          }}
          onCancel={() => setIsConfirming(false)}
        />
      </li>
    );
  }

  return (
    <li data-chat-row={chatId} data-idle={isIdle ? 'true' : undefined}>
      <InteractiveRow
        label={title}
        isSelected={isSelected}
        onOpen={() => onSelect(chatId)}
        frameClassName="group"
        className="flex min-w-0 flex-col gap-0.5 py-1.5 pl-4 pr-2"
        menu={{
          onContextMenu: openAtPointer,
          onKeyDown: (event) => {
            if (event.defaultPrevented || !isMenuKey(event)) {
              return;
            }
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            setMenuPoint({ x: rect.left + 8, y: rect.bottom });
          },
        }}
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
                  isUnread ? 'font-medium' : '',
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
              {marker === null ? null : <ChatSessionMark marker={marker} />}
              <span className="min-w-0 truncate">{snippet}</span>
            </>
          )}
        </span>
        {isRenaming ? null : (
          <span
            ref={moreRef}
            className={cn(
              'absolute right-0 top-0 flex items-center opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
              menuPoint === null ? '' : 'opacity-100',
            )}
          >
            <IconButton
              icon={isPinned ? PinOff : Pin}
              label={isPinned ? `Unpin ${title}` : `Pin ${title}`}
              tooltip={isPinned ? 'Unpin' : 'Pin'}
              variant="ghost"
              iconSize={12}
              onClick={() => onPin({ chatId, isPinned: !isPinned })}
            />
            <IconButton
              icon={Ellipsis}
              label={`More actions for ${title}`}
              tooltip="More"
              variant="ghost"
              iconSize={ICON_SIZE.row}
              onClick={openAtButton}
            />
          </span>
        )}
      </InteractiveRow>
      {menuPoint === null ? null : (
        <ContextMenu
          label={`Actions for ${title}`}
          point={menuPoint}
          entries={entries}
          onClose={() => setMenuPoint(null)}
        />
      )}
    </li>
  );
};

export const ChatListRow = memo(ChatListRowView);
