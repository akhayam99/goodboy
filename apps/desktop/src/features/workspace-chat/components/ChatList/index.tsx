import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, SquarePen } from 'lucide-react';
import { Button, ScrollFade } from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { markdownPreview } from '../../../../shared/utils/markdownPreview';
import { pluralize } from '../../../../shared/utils/pluralize';
import { useAppStore } from '../../../../store';
import { selectChatGroups } from '../../../../store/slices/chats/selectChatGroups';
import { chatRowTime } from '../../chatRowTime';
import { ChatArchivedView } from './ChatArchivedView';
import { ChatListGroup, type ChatListGroupRow } from './ChatListGroup';
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

  const archiveOne = (chatId: ChatId): void => {
    const title = chats.find((chat) => chat.id === chatId)?.title ?? 'Chat';
    void archiveChats({ workspaceId, chatIds: [chatId] });
    setArchived({ chatIds: [chatId], label: `Archived ${title}`, isIdle: false });
    onArchived([chatId]);
  };

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

  const deleteMany = async (chatIds: ReadonlyArray<ChatId>): Promise<void> => {
    await deleteChats({ workspaceId, chatIds });
    onDeleted(chatIds);
  };

  const deleteOne = (chatId: ChatId): Promise<void> => deleteMany([chatId]);

  const onPin = ({ chatId, isPinned }: PinParams): void => {
    void pinChat({ chatId, isPinned });
  };

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
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2">
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
        <nav aria-label="Chats" className="flex flex-col gap-3 pb-3 pr-3.5">
          {archived !== null && !archived.isIdle ? undoRow : null}
          <ChatListGroup
            title="Pinned"
            rows={groups.pinned}
            selectedId={selectedId}
            onSelect={onSelect}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
          />
          <ChatListGroup
            title="Today"
            rows={groups.today}
            selectedId={selectedId}
            onSelect={onSelect}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
          />
          <ChatListGroup
            title="This week"
            rows={groups.week}
            selectedId={selectedId}
            onSelect={onSelect}
            onPin={onPin}
            onArchive={archiveOne}
            onDelete={deleteOne}
          />
          <ChatListGroup
            title="Idle"
            rows={groups.idle}
            selectedId={selectedId}
            onSelect={onSelect}
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
          {isEmpty && archived === null ? (
            <p className="px-2 py-4 text-label text-faint-foreground">
              {needle === '' ? 'No chats yet' : 'No chats match'}
            </p>
          ) : null}
        </nav>
      </ScrollFade>
      {archivedChats.length === 0 ? null : (
        <div className="shrink-0 pb-2">
          <button
            type="button"
            onClick={() => setIsArchivedView(true)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
