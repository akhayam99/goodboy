import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { sessionTitle } from '../../../session/sessionTitle';
import type { ChatSessionEntry } from '../../chatSessionEntries';

type Props = {
  readonly entry: ChatSessionEntry;
  readonly onOpen: (sessionId: SessionId) => void;
};

const VERB: Record<ChatSessionEntry['link']['kind'], string> = {
  new: 'Started',
  add: 'Added to',
};

export const ChatHandoffNote = ({ entry, onOpen }: Props) => {
  const title = sessionTitle({ session: entry.session });
  const verb = VERB[entry.link.kind];
  return (
    <Tooltip content={`Open ${title}`} anchorClassName="flex min-w-0 self-start">
      <button
        type="button"
        aria-label={`${verb} ${title}`}
        onClick={() => onOpen(entry.session.id)}
        className={cn(
          'group/started flex min-w-0 items-center gap-1 rounded-sm text-meta text-faint-foreground motion-safe:transition-colors hover:text-muted-foreground',
          FOCUS_RING,
        )}
      >
        <CONCEPT_ICONS.sessions size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="shrink-0">{verb}</span>
        <span className="min-w-0 truncate text-muted-foreground group-hover/started:text-foreground">
          {title}
        </span>
      </button>
    </Tooltip>
  );
};
