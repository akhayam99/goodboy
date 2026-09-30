import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useChatOrigin } from '../../../workspace-chat/hooks/useChatOrigin';

type Props = {
  readonly session: Session;
};

export const ChatOriginRow = ({ session }: Props) => {
  const origin = useChatOrigin({ session });
  const openStudio = useAppStore((state) => state.openStudio);
  if (origin === null) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => openStudio({ studio: { kind: 'chat', chatId: origin.chatId } })}
      title={`Open the chat ${origin.title}`}
      className="flex min-w-0 items-center gap-1.5 self-start rounded-sm text-left text-label text-muted-foreground motion-safe:transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="shrink-0">From chat ·</span>
      <span className="min-w-0 truncate text-foreground">{origin.title}</span>
    </button>
  );
};
