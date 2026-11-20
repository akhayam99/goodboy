import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search } from '@goodboy/ui/icons';
import { cn, ICON_SIZE, ROW_INTERACTIVE, ScrollFade } from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useMultiSelect } from '../../../../shared/hooks/useMultiSelect';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import { useAppStore } from '../../../../store';
import type { ObjectTarget } from '../../../actions/types';
import { useActionControls } from '../../../actions/useActionControls';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import type { RemovedChats } from '../../nextChatAfter';
import { offerArchiveUndo } from '../../offerArchiveUndo';
import { chatGroupRowsOf } from './chatGroupRowsOf';
import { chatOrderOf } from './chatOrderOf';
import { ChatArchivedView } from './ChatArchivedView';
import { ChatListGroup } from './ChatListGroup';
import { ChatListStatus } from './ChatListStatus';
import type { ChatRowSelection } from './ChatListRow';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly selectedId: ChatId | null;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onArchived: (removed: RemovedChats) => void;
  readonly onDeleted: (removed: RemovedChats) => void;
};

type FailureParams = {
  readonly title: string;
  readonly error: unknown;
};

type RestoreParams = {
  readonly chatIds: ReadonlyArray<ChatId>;
};

type PinParams = {
  readonly chatId: ChatId;
  readonly isPinned: boolean;
};

const CHAT_ARCHIVED = 'Chat archived';
const ARCHIVE_FAILED = "Couldn't archive the chat";
const RESTORE_FAILED = "Couldn't restore the chat";
const DELETE_FAILED = "Couldn't delete the chat";
const PIN_FAILED = "Couldn't pin the chat";
const UNPIN_FAILED = "Couldn't unpin the chat";

const NO_CHATS: ReadonlyArray<ChatSummary> = [];

const SELECTION_VERB_IDS = ['chats.archive', 'chats.delete'];

export const ChatList = ({
  workspaceId,
  chats,
  selectedId,
  onSelect,
  onArchived,
  onDeleted,
}: Props) => {
  const hasLoaded = useAppStore((state) => state.chatsByWorkspace[workspaceId] !== undefined);
  const error = useAppStore((state) => state.chatLoadErrors?.[workspaceId] ?? null);
  const loadChats = useAppStore((state) => state.loadChats);
  const loadState = loadStateOf({ hasLoaded, isLoading: !hasLoaded, error, count: chats.length });
  const archiveChats = useAppStore((state) => state.archiveChats);
  const archiveIdleChats = useAppStore((state) => state.archiveIdleChats);
  const restoreChats = useAppStore((state) => state.restoreChats);
  const deleteChats = useAppStore((state) => state.deleteChats);
  const loadArchivedChats = useAppStore((state) => state.loadArchivedChats);
  const archivedChats = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] ?? NO_CHATS,
  );
  const pinChat = useAppStore((state) => state.pinChat);
  const reportError = useAppStore((state) => state.reportError);
  const showToast = useShowToast();
  const [query, setQuery] = useState('');
  const [isArchivedView, setIsArchivedView] = useState(false);
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    void loadArchivedChats({ workspaceId });
  }, [workspaceId, loadArchivedChats]);

  const groups = useMemo(
    () => chatGroupRowsOf({ chats, needle, now: Date.now() }),
    [chats, needle],
  );
  const order = useMemo(() => chatOrderOf({ groups }), [groups]);

  const latest = useRef({ chats, order, selectedId, onSelect, onArchived, onDeleted, showToast });
  latest.current = { chats, order, selectedId, onSelect, onArchived, onDeleted, showToast };

  const select = useCallback((chatId: ChatId) => latest.current.onSelect(chatId), []);

  const reportFailure = useCallback(
    ({ title, error }: FailureParams): void => {
      void reportError({ recovery: NOTHING_CHANGED, title, error, workspaceId });
    },
    [reportError, workspaceId],
  );

  const archiveMany = useCallback(
    async (chatIds: ReadonlyArray<ChatId>): Promise<void> => {
      const [first] = chatIds;
      if (first === undefined) {
        return;
      }
      const { chats: known, order: before, selectedId: wasSelected, showToast } = latest.current;
      const title = known.find((chat) => chat.id === first)?.title ?? 'Chat';
      try {
        await archiveChats({ workspaceId, chatIds });
      } catch (error) {
        reportFailure({ title: ARCHIVE_FAILED, error });
        return;
      }
      offerArchiveUndo({
        workspaceId,
        chatIds,
        selectedId: wasSelected,
        showToast,
        ...(chatIds.length === 1
          ? { title: CHAT_ARCHIVED, message: title }
          : { message: `${pluralize(chatIds.length, 'chat')} archived` }),
      });
      latest.current.onArchived({ removedIds: chatIds, order: before });
    },
    [archiveChats, reportFailure, workspaceId],
  );

  const archiveOne = useCallback(
    (chatId: ChatId): void => void archiveMany([chatId]),
    [archiveMany],
  );

  const archiveIdle = async (): Promise<void> => {
    const { order: before, selectedId: wasSelected } = latest.current;
    let chatIds: ReadonlyArray<ChatId>;
    try {
      chatIds = await archiveIdleChats({ workspaceId });
    } catch (error) {
      reportFailure({ title: ARCHIVE_FAILED, error });
      return;
    }
    if (chatIds.length === 0) {
      return;
    }
    offerArchiveUndo({
      workspaceId,
      chatIds,
      selectedId: wasSelected,
      showToast,
      message: `${pluralize(chatIds.length, 'idle chat')} archived`,
    });
    onArchived({ removedIds: chatIds, order: before });
  };

  const restore = async ({ chatIds }: RestoreParams): Promise<void> => {
    try {
      await restoreChats({ workspaceId, chatIds });
    } catch (error) {
      reportFailure({ title: RESTORE_FAILED, error });
    }
  };

  const deleteMany = useCallback(
    async (chatIds: ReadonlyArray<ChatId>): Promise<void> => {
      const before = latest.current.order;
      try {
        await deleteChats({ workspaceId, chatIds });
      } catch (error) {
        reportFailure({ title: DELETE_FAILED, error });
        return;
      }
      latest.current.onDeleted({ removedIds: chatIds, order: before });
    },
    [deleteChats, reportFailure, workspaceId],
  );

  const deleteOne = useCallback(
    (chatId: ChatId): Promise<void> => deleteMany([chatId]),
    [deleteMany],
  );

  const onPin = useCallback(
    ({ chatId, isPinned }: PinParams): void => {
      pinChat({ chatId, isPinned }).catch((error: unknown) => {
        reportFailure({ title: isPinned ? PIN_FAILED : UNPIN_FAILED, error });
      });
    },
    [pinChat, reportFailure],
  );

  const multi = useMultiSelect(order);
  const { selected, clear, toggle, selectRange, selectAll, selectIds, handleItemClick } = multi;
  const selectedIds = useMemo(() => {
    const chosen = new Set<ChatId>(selected);
    return order.filter((chatId) => chosen.has(chatId));
  }, [order, selected]);
  const checkedIds = useMemo<ReadonlySet<ChatId>>(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (selectedIds.length !== selected.length) {
      selectIds(selectedIds, 'replace');
    }
  }, [selectedIds, selected.length, selectIds]);

  const selectionTarget = useMemo<ObjectTarget | null>(
    () =>
      selectedIds.length === 0
        ? null
        : {
            kind: 'chats',
            facts: {
              chatIds: selectedIds,
              titles: selectedIds.map(
                (chatId) => chats.find((chat) => chat.id === chatId)?.title ?? 'Chat',
              ),
              onArchive: () => void archiveMany(selectedIds),
              onDelete: () => deleteMany(selectedIds),
            },
          },
    [archiveMany, chats, deleteMany, selectedIds],
  );
  const selectionControls = useActionControls({ target: selectionTarget });
  const triggerSelectionAction = selectionControls.trigger;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLElement | null>(null);

  useSelectionKeys({
    containerRef: rootRef,
    hasSelection: selectedIds.length > 0,
    onToggle: (chatId) => toggle(chatId as ChatId),
    onSelectAll: selectAll,
    onDelete: () => triggerSelectionAction({ actionId: 'chats.delete' }),
    isEnabled: !isArchivedView,
  });

  useEffect(() => {
    if (isArchivedView) {
      clear();
    }
  }, [isArchivedView, clear]);

  const selectionState = useRef({ ids: selectedIds, target: selectionTarget });
  selectionState.current = { ids: selectedIds, target: selectionTarget };

  const rowSelection = useMemo<ChatRowSelection>(
    () => ({
      getSelectedIds: () => selectionState.current.ids,
      getTarget: () => selectionState.current.target,
      clear,
      onToggle: (chatId, event) => (event.shiftKey ? selectRange(chatId) : toggle(chatId)),
      onModifierClick: handleItemClick,
    }),
    [clear, handleItemClick, selectRange, toggle],
  );

  const focusFirstRow = useCallback(() => {
    listRef.current?.querySelector<HTMLElement>('[data-select-id]')?.focus();
  }, []);

  const isEmpty =
    groups.pinned.length + groups.today.length + groups.week.length + groups.idle.length === 0;

  if (isArchivedView) {
    return (
      <ChatArchivedView
        chats={archivedChats}
        selectedId={selectedId}
        onSelect={onSelect}
        onBack={() => setIsArchivedView(false)}
        onRestore={(chatId) => void restore({ chatIds: [chatId] })}
        onDelete={deleteMany}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="@container/chat-list relative flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2"
    >
      <label className="flex h-7 items-center gap-2 rounded-md border border-border-soft px-2 text-faint-foreground focus-within:border-border">
        <Search size={ICON_SIZE.row} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent text-meta text-foreground outline-none placeholder:text-faint-foreground"
        />
      </label>
      <ScrollFade className="flex-1">
        <nav
          ref={listRef}
          aria-label="Chats"
          data-selecting={selectedIds.length > 0}
          className="group/select-list flex flex-col gap-3 pb-3 pr-4"
        >
          <ChatListGroup
            title="Pinned"
            rows={groups.pinned}
            selectedId={selectedId}
            checkedIds={checkedIds}
            selection={rowSelection}
            onSelect={select}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
          />
          <ChatListGroup
            title="Today"
            rows={groups.today}
            selectedId={selectedId}
            checkedIds={checkedIds}
            selection={rowSelection}
            onSelect={select}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
          />
          <ChatListGroup
            title="This week"
            rows={groups.week}
            selectedId={selectedId}
            checkedIds={checkedIds}
            selection={rowSelection}
            onSelect={select}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
          />
          <ChatListGroup
            title="Idle"
            rows={groups.idle}
            selectedId={selectedId}
            checkedIds={checkedIds}
            selection={rowSelection}
            onSelect={select}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
            action={
              needle === '' && groups.idle.length > 0
                ? { label: 'Archive idle', onClick: () => void archiveIdle() }
                : null
            }
          />
          <ChatListStatus
            loadState={loadState}
            error={error}
            isEmpty={isEmpty}
            isFiltered={needle !== ''}
            onRetry={() => void loadChats({ workspaceId })}
            onClearFilter={() => setQuery('')}
          />
        </nav>
      </ScrollFade>
      <ObjectSelectionBar
        controls={selectionControls}
        verbIds={SELECTION_VERB_IDS}
        count={selectedIds.length}
        total={order.length}
        onClear={clear}
        onSelectAll={selectAll}
        onDone={clear}
        onFocusReturn={focusFirstRow}
        placement="flow"
        className="shrink-0 pb-1"
      />
      {archivedChats.length === 0 ? null : (
        <div className="shrink-0 pb-2">
          <button
            type="button"
            onClick={() => setIsArchivedView(true)}
            className={cn(
              'flex h-8 w-full items-center gap-2 rounded-md px-2 text-meta text-muted-foreground hover:text-foreground',
              ROW_INTERACTIVE,
            )}
          >
            <CONCEPT_ICONS.archive size={ICON_SIZE.control} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">
              Archived · {archivedChats.length}
            </span>
            <ChevronRight size={ICON_SIZE.control} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
};
