import { memo, useMemo, useState, type MouseEvent } from 'react';
import { Ellipsis, Pin, PinOff } from 'lucide-react';
import { IconButton, InteractiveRow, SelectionCheckbox, StatusDot, cn } from '@goodboy/ui';
import type { ChatId, ChatModelUsed, EffortLevel, ProviderId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { chatSelectionTarget } from '../../../actions/chatSelectionTarget';
import { chatObjectKey } from '../../../actions/kinds/chat';
import type { ObjectTarget } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { useChatSessionMarker } from '../../hooks/useChatSessionMarker';
import { ChatDeleteConfirm } from './ChatDeleteConfirm';
import { ChatModelGlyphs } from './ChatModelGlyphs';
import { ChatRenameInput } from './ChatRenameInput';
import { ChatSessionMark } from './ChatSessionMark';

export type ChatRowSelection = {
  readonly getSelectedIds: () => ReadonlyArray<ChatId>;
  readonly getTarget: () => ObjectTarget | null;
  readonly clear: () => void;
  readonly onToggle: (chatId: ChatId, event: { readonly shiftKey: boolean }) => void;
  readonly onModifierClick: (chatId: ChatId, event: ModifierEvent) => void;
};

type ModifierEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type Props = {
  readonly chatId: ChatId;
  readonly title: string;
  readonly snippet: string;
  readonly time: string;
  readonly isIdle: boolean;
  readonly isPinned: boolean;
  readonly models: ReadonlyArray<ChatModelUsed>;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly messageCount: number;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  readonly selection: ChatRowSelection;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onPin: (params: { readonly chatId: ChatId; readonly isPinned: boolean }) => void;
  readonly onArchive: (chatId: ChatId) => void;
  readonly onDelete: (chatId: ChatId) => Promise<void>;
};

const hasModifier = (event: ModifierEvent): boolean =>
  event.shiftKey || event.metaKey || event.ctrlKey || event.altKey;

const SELECT_TARGET = '[data-select-id]';

const ChatListRowView = ({
  chatId,
  title,
  snippet,
  time,
  isIdle,
  isPinned,
  models,
  provider,
  model,
  effort,
  messageCount,
  isSelected,
  isChecked,
  selection,
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
  const [isConfirming, setIsConfirming] = useState(false);
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
  const menu = useObjectMenuTrigger({
    target,
    anchorKey,
    onBeforeOpen: () =>
      chatSelectionTarget({
        chatId,
        selectedIds: selection.getSelectedIds(),
        clearSelection: selection.clear,
        single: target,
        several: selection.getTarget(),
      }),
  });

  const captureModifierClick = (event: MouseEvent<HTMLLIElement>): void => {
    const isOpener =
      event.target instanceof Element && event.target.closest(SELECT_TARGET) !== null;
    if (!isOpener || !hasModifier(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selection.onModifierClick(chatId, event);
  };

  if (isConfirming) {
    return (
      <li data-chat-row={chatId}>
        <ChatDeleteConfirm
          title={title}
          canArchive
          onDelete={() => onDelete(chatId)}
          onArchive={() => onArchive(chatId)}
          onCancel={() => setIsConfirming(false)}
        />
      </li>
    );
  }

  return (
    <li
      data-chat-row={chatId}
      data-idle={isIdle ? 'true' : undefined}
      data-checked={isChecked ? 'true' : undefined}
      onClickCapture={captureModifierClick}
    >
      <InteractiveRow
        label={title}
        isSelected={isSelected}
        onOpen={() => onSelect(chatId)}
        frameClassName={cn('group group/select-row', isChecked && 'bg-selected')}
        className="flex min-w-0 flex-col gap-0.5 py-2 pl-7 pr-1"
        dataAttributes={{ 'data-select-id': chatId }}
        menu={menu}
      >
        <span className="relative flex min-h-6 min-w-0 items-center gap-1">
          <SelectionCheckbox
            checked={isChecked}
            label={`Select ${title}`}
            onToggle={(event) => selection.onToggle(chatId, event)}
            className="absolute -left-[21px] top-1/2 -translate-y-1/2"
          />
          {isStreaming ? (
            <StatusDot
              tone="info"
              pulsing
              ariaLabel="Answering"
              className="absolute -left-4 top-1/2 -translate-y-1/2 group-focus-within/select-row:invisible group-hover/select-row:invisible group-data-[selecting=true]/select-list:invisible"
            />
          ) : null}
          {!isStreaming && isUnread ? (
            <StatusDot
              tone="warning"
              ariaLabel="New reply"
              className="absolute -left-4 top-1/2 -translate-y-1/2 group-focus-within/select-row:invisible group-hover/select-row:invisible group-data-[selecting=true]/select-list:invisible"
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
                  'min-w-0 flex-1 truncate text-label',
                  isIdle && !isSelected ? 'text-faint-foreground' : 'text-foreground',
                )}
              >
                {title}
              </span>
              <span className="group/slot relative h-6 w-11 shrink-0">
                <span className="absolute inset-y-0 right-1 flex items-center text-meta text-faint-foreground motion-safe:transition-opacity group-focus-within:opacity-0 group-hover:opacity-0 group-has-[[aria-expanded=true]]/slot:opacity-0">
                  {time}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center opacity-0 motion-safe:transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-has-[[aria-expanded=true]]/slot:opacity-100">
                  <IconButton
                    size="xs"
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
                    triggerClassName="p-1"
                  />
                </span>
              </span>
              <IconButton
                size="xs"
                icon={CONCEPT_ICONS.delete}
                label={`Delete ${title}`}
                tooltip="Delete"
                variant="ghost"
                iconSize={12}
                className="opacity-60 motion-safe:transition-opacity hover:text-danger focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                onClick={() => setIsConfirming(true)}
              />
            </>
          )}
        </span>
        <span
          className={cn(
            'flex min-w-0 items-center gap-1 text-meta',
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
              <span className="min-w-0 flex-1 truncate">{snippet}</span>
              <ChatModelGlyphs
                models={models}
                provider={provider}
                model={model}
                effort={effort}
                messageCount={messageCount}
              />
            </>
          )}
        </span>
      </InteractiveRow>
    </li>
  );
};

export const ChatListRow = memo(ChatListRowView);
