import { Check } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SESSION_STAGE_META } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';
import type { ChatSessionEntry } from '../../chatSessionEntries';

type Props = {
  readonly entry: ChatSessionEntry;
  readonly onOpen: (sessionId: SessionId) => void;
};

const LABEL: Record<ChatSessionEntry['link']['kind'], string> = {
  new: 'Started a session',
  add: 'Added to a session',
};

export const ChatHandoffNote = ({ entry, onOpen }: Props) => (
  <div
    role="status"
    className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-2.5 py-1.5 text-label text-muted-foreground"
  >
    <Check size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
    <span className="shrink-0">{LABEL[entry.link.kind]} ·</span>
    <span className="min-w-0 flex-1 truncate text-foreground">
      {sessionTitle({ session: entry.session })}
    </span>
    <span className="shrink-0 text-faint-foreground">{SESSION_STAGE_META[entry.stage].label}</span>
    <button
      type="button"
      onClick={() => onOpen(entry.session.id)}
      className="shrink-0 rounded-sm px-1.5 py-0.5 text-foreground motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      Open session
    </button>
  </div>
);
