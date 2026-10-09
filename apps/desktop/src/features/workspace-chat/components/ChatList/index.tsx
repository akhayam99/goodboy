import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, SquarePen } from 'lucide-react';
import {
  ROW_INTERACTIVE,
  cn,
  Button,
  EmptyLine,
  EmptyState,
  Notice,
  SkeletonRow,
  ScrollFade,
} from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { markdownPreview } from '../../../../shared/utils/markdownPreview';
import { pluralize } from '../../../../shared/utils/pluralize';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { useMultiSelect } from '../../../../shared/hooks/useMultiSelect';
import { ObjectSelectionBar } from '../../../../shared/components/ObjectSelectionBar';
import { useAppStore } from '../../../../store';
import { selectChatGroups } from '../../../../store/slices/chats/selectChatGroups';
import type { ObjectTarget } from '../../../actions/types';
import { useActionControls } from '../../../actions/useActionControls';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import { chatRowTime } from '../../chatRowTime';
import { ChatArchivedView } from './ChatArchivedView';
import { ChatListGroup, type ChatListGroupRow } from './ChatListGroup';
import type { ChatRowSelection } from './ChatListRow';
import { ChatUndoRow } from './ChatUndoRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly selectedId: ChatId | null;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onNew: () => void;
  readonly onArchived: (chatIds: ReadonlyArray<ChatId>) => void;
  readonly onDeleted: (chatIds: ReadonlyArray<ChatId>) => void;
};

type Archived = {
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly label: string;
  readonly isIdle: boolean;
};

type PinParams = {
  readonly chatId: ChatId;
  readonly isPinned: boolean;
};

type RowsParams = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly now: number;
  readonly isIdle: boolean;
};

const NO_ANSWER = 'No answer yet';

const NO_CHATS: ReadonlyArray<ChatSummary> = [];

const SELECTION_VERB_IDS = ['chats.archive', 'chats.delete'];

const rowsOf = ({ chats, now, isIdle }: RowsParams): ReadonlyArray<ChatListGroupRow> =>
  chats.map((chat) => {
    const preview = markdownPreview({ text: chat.preview });
    return {
      chatId: chat.id,
      title: chat.title,
      snippet: preview === '' ? NO_ANSWER : preview,
      time: chatRowTime({ chat, now }),
      isIdle,
      isPinned: chat.pinnedAt !== null,
      models: chat.modelsUsed,
      provider: chat.provider,
      model: chat.model,
      effort: chat.effort,
      messageCount: chat.messageCount,
    };
  });

type MatchParams = {
  readonly chat: ChatSummary;
  readonly needle: string;
};

const matches = ({ chat, needle }: MatchParams): boolean =>
  needle === '' ||
  `${chat.title} ${markdownPreview({ text: chat.preview })}`.toLowerCase().includes(needle);

export const ChatList = ({
  workspaceId,
  chats,
  selectedId,
  onSelect,
  onNew,
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
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState<Archived | null>(null);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    void loadArchivedChats({ workspaceId });
  }, [workspaceId, loadArchivedChats]);

  const groups = useMemo(() => {
    const now = Date.now();
    const grouped = selectChatGroups({
      chats: chats.filter((chat) => matches({ chat, needle })),
      now,
    });
    return {
      pinned: rowsOf({ chats: grouped.pinned, now, isIdle: false }),
      today: rowsOf({ chats: grouped.today, now, isIdle: false }),
      week: rowsOf({ chats: grouped.week, now, isIdle: false }),
      idle: rowsOf({ chats: grouped.idle, now, isIdle: true }),
    };
  }, [chats, needle]);

  const latest = useRef({ chats, onSelect, onArchived, onDeleted });
  latest.current = { chats, onSelect, onArchived, onDeleted };

  const select = useCallback((chatId: ChatId) => latest.current.onSelect(chatId), []);

  const archiveMany = useCallback(
    (chatIds: ReadonlyArray<ChatId>): void => {
      const [first] = chatIds;
      if (first === undefined) {
        return;
      }
      const title = latest.current.chats.find((chat) => chat.id === first)?.title ?? 'Chat';
      void archiveChats({ workspaceId, chatIds });
      setArchived({
        chatIds,
        label:
          chatIds.length === 1
            ? `Archived ${title}`
            : `${pluralize(chatIds.length, 'chat')} archived`,
        isIdle: false,
      });
      latest.current.onArchived(chatIds);
    },
    [archiveChats, workspaceId],
  );

  const archiveOne = useCallback((chatId: ChatId): void => archiveMany([chatId]), [archiveMany]);

  const archiveIdle = async (): Promise<void> => {
    const chatIds = await archiveIdleChats({ workspaceId });
    if (chatIds.length === 0) {
      return;
    }
    setArchived({
      chatIds,
      label: `${pluralize(chatIds.length, 'idle chat')} archived`,
      isIdle: true,
    });
    onArchived(chatIds);
  };

  const undo = (): void => {
    if (archived === null) {
      return;
    }
    void restoreChats({ workspaceId, chatIds: archived.chatIds });
    setArchived(null);
  };

  const deleteMany = useCallback(
    async (chatIds: ReadonlyArray<ChatId>): Promise<void> => {
      await deleteChats({ workspaceId, chatIds });
      latest.current.onDeleted(chatIds);
    },
    [deleteChats, workspaceId],
  );

  const deleteOne = useCallback(
    (chatId: ChatId): Promise<void> => deleteMany([chatId]),
    [deleteMany],
  );

  const onPin = useCallback(
    ({ chatId, isPinned }: PinParams): void => {
      void pinChat({ chatId, isPinned });
    },
    [pinChat],
  );

  const order = useMemo(
    () =>
      [...groups.pinned, ...groups.today, ...groups.week, ...groups.idle].map((row) => row.chatId),
    [groups],
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
              onArchive: () => archiveMany(selectedIds),
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

  const undoRow = archived === null ? null : <ChatUndoRow label={archived.label} onUndo={undo} />;
  const isEmpty =
    groups.pinned.length + groups.today.length + groups.week.length + groups.idle.length === 0;

  if (isArchivedView) {
    return (
      <ChatArchivedView
        chats={archivedChats}
        selectedId={selectedId}
        onSelect={onSelect}
        onBack={() => setIsArchivedView(false)}
        onRestore={(chatId) => void restoreChats({ workspaceId, chatIds: [chatId] })}
        onDelete={deleteMany}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="@container/chat-list relative flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2"
    >
      <Button variant="secondary" className="justify-start" onClick={onNew}>
        <SquarePen size={ICON_SIZE.control} aria-hidden />
        New chat
      </Button>
      <label className="flex h-7 items-center gap-2 rounded-md border border-border-soft px-2 text-faint-foreground focus-within:border-border">
        <Search size={ICON_SIZE.row} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent text-label text-foreground outline-none placeholder:text-faint-foreground"
        />
      </label>
      <ScrollFade className="flex-1">
        <nav
          ref={listRef}
          aria-label="Chats"
          data-selecting={selectedIds.length > 0}
          className="group/select-list flex flex-col gap-3 pb-3 pr-4"
        >
          {archived !== null && !archived.isIdle ? undoRow : null}
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
            footer={archived !== null && archived.isIdle ? undoRow : null}
          />
          {loadState === 'loading' ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <SkeletonRow key={index} label="Loading chats" />
              ))}
            </div>
          ) : loadState === 'error' ? (
            <Notice
              tone="danger"
              placement="inline"
              role="alert"
              title="Could not load chats"
              detail={error}
              actions={
                <Button size="sm" onClick={() => void loadChats({ workspaceId })}>
                  Retry
                </Button>
              }
            />
          ) : isEmpty && archived === null ? (
            needle === '' ? (
              <EmptyState
                size="page"
                icon={CONCEPT_ICONS.chat}
                title="No chats yet"
                description="Start a chat to explore an idea with an agent."
                action={
                  <Button size="sm" onClick={onNew}>
                    Start a chat
                  </Button>
                }
              />
            ) : (
              <EmptyLine
                action={
                  <Button size="sm" variant="ghost" onClick={() => setQuery('')}>
                    Clear filter
                  </Button>
                }
              >
                No chats match this filter.
              </EmptyLine>
            )
          ) : null}
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
              'flex h-8 w-full items-center gap-2 rounded-md px-2 text-label text-muted-foreground hover:text-foreground',
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
