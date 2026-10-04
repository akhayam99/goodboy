import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ChatDraft } from '../../hooks/useChatDrafts';

type Props = {
  readonly draft: ChatDraft;
  readonly onOpen: (sessionId: SessionId) => void;
};

export const ChatDraftNote = ({ draft, onOpen }: Props) => (
  <div
    role="status"
    className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-3 py-2 text-label text-muted-foreground"
  >
    <span className="flex min-w-0 items-center gap-2">
      <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">
        {`Draft added to ${draft.title}. Send it there to link this chat.`}
      </span>
    </span>
    <Button
      variant="secondary"
      size="sm"
      className="self-start"
      onClick={() => onOpen(draft.session.id)}
    >
      Send in the session
    </Button>
  </div>
);
