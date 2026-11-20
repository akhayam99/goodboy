import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search } from '@goodboy/ui/icons';
import {
  Button,
  cn,
  EmptyLine,
  ICON_SIZE,
  Notice,
  ROW_INTERACTIVE,
  ScrollFade,
  SkeletonRow,
} from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
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
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly selectedId: ChatId | null;
  readonly onSelect: (chatId: ChatId) => void;
  readonly onArchived: (chatIds: ReadonlyArray<ChatId>) => void;
  readonly onDeleted: (chatIds: ReadonlyArray<ChatId>) => void;
};

type Archived = {
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly label: string;
  readonly isIdle: boolean;
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

type RowsParams = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly now: number;
  readonly isIdle: boolean;
};

const NO_ANSWER = 'No answer yet';
const ARCHIVE_FAILED = "Couldn't archive the chat";
const RESTORE_FAILED = "Couldn't restore the chat";
const DELETE_FAILED = "Couldn't delete the chat";
const PIN_FAILED = "Couldn't pin the chat";
const UNPIN_FAILED = "Couldn't unpin the chat";

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
      const title = latest.current.chats.find((chat) => chat.id === first)?.title ?? 'Chat';
      try {
        await archiveChats({ workspaceId, chatIds });
      } catch (error) {
        reportFailure({ title: ARCHIVE_FAILED, error });
        return;
      }
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
    [archiveChats, reportFailure, workspaceId],
  );

  const archiveOne = useCallback(
    (chatId: ChatId): void => void archiveMany([chatId]),
    [archiveMany],
  );

  const archiveIdle = async (): Promise<void> => {
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
    setArchived({
      chatIds,
      label: `${pluralize(chatIds.length, 'idle chat')} archived`,
      isIdle: true,
    });
    onArchived(chatIds);
  };

  const restore = async ({ chatIds }: RestoreParams): Promise<boolean> => {
    try {
      await restoreChats({ workspaceId, chatIds });
      return true;
    } catch (error) {
      reportFailure({ title: RESTORE_FAILED, error });
      return false;
    }
  };

  const undo = async (): Promise<void> => {
    if (archived === null) {
      return;
    }
    if (await restore({ chatIds: archived.chatIds })) {
      setArchived(null);
    }
  };

  const deleteMany = useCallback(
    async (chatIds: ReadonlyArray<ChatId>): Promise<void> => {
      try {
        await deleteChats({ workspaceId, chatIds });
      } catch (error) {
        reportFailure({ title: DELETE_FAILED, error });
        return;
      }
      latest.current.onDeleted(chatIds);
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

  const undoRow =
    archived === null ? null : <ChatUndoRow label={archived.label} onUndo={() => void undo()} />;
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
              title="Couldn't load chats"
              detail={error}
              actions={
                <Button size="sm" onClick={() => void loadChats({ workspaceId })}>
                  Retry
                </Button>
              }
            />
          ) : isEmpty && archived === null ? (
            needle === '' ? null : (
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
