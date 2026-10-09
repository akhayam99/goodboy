import { useEffect } from 'react';
import { FOCUS_RING, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useChatOrigins } from '../../../../shared/hooks/useChatOrigins';
import type { ChatOrigin } from '../../../../store/slices/chats/selectChatOrigins';
import { MoreChatOrigins } from './MoreChatOrigins';

type Props = {
  readonly session: Session;
};

const KIND_LABEL = {
  new: 'From chat',
  add: 'Fed by chat',
} as const;

type PrimaryParams = {
  readonly origins: ReadonlyArray<ChatOrigin>;
};

const primaryOriginOf = ({ origins }: PrimaryParams): ChatOrigin | null => {
  const started = origins.filter((origin) => origin.kind === 'new');
  return started.at(-1) ?? origins.at(-1) ?? null;
};

const labelOf = ({ origin }: { readonly origin: ChatOrigin }): string =>
  `${KIND_LABEL[origin.kind]}: ${origin.title}`;

export const ChatOriginRow = ({ session }: Props) => {
  const { id: sessionId, workspaceId } = session;
  const origins = useChatOrigins({ sessionId });
  const openStudio = useAppStore((state) => state.openStudio);
  const isChatsLoaded = useAppStore((state) => state.chatsByWorkspace[workspaceId] !== undefined);
  const isArchivedLoaded = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] !== undefined,
  );
  const hasLinks = useAppStore((state) =>
    Object.values(state.chatLinks).some((links) =>
      links.some((link) => link.sessionId === sessionId),
    ),
  );
  const loadChats = useAppStore((state) => state.loadChats);
  const loadArchivedChats = useAppStore((state) => state.loadArchivedChats);

  useEffect(() => {
    if (!isChatsLoaded) {
      void loadChats({ workspaceId });
    }
  }, [isChatsLoaded, loadChats, workspaceId]);

  useEffect(() => {
    if (hasLinks && !isArchivedLoaded) {
      void loadArchivedChats({ workspaceId });
    }
  }, [hasLinks, isArchivedLoaded, loadArchivedChats, workspaceId]);

  const primary = primaryOriginOf({ origins });
  if (primary === null) {
    return null;
  }
  const others = origins.filter((origin) => origin.chatId !== primary.chatId);
  const open = ({ chatId }: Pick<ChatOrigin, 'chatId'>) =>
    openStudio({ studio: { kind: 'chat', chatId } });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => open(primary)}
        title={`Open the chat ${primary.title}`}
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-sm text-left text-label text-muted-foreground motion-safe:transition-colors hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="shrink-0">{`${KIND_LABEL[primary.kind]}: `}</span>
        <span className="min-w-0 truncate text-foreground">{primary.title}</span>
      </button>
      {others.length === 0 ? null : (
        <MoreChatOrigins origins={others} onOpen={open} labelOf={labelOf} />
      )}
    </div>
  );
};
