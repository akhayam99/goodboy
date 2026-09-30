import { Button, StatusDot } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';
import type { ChatSessionEntry } from '../../chatSessionEntries';

type Props = {
  readonly entry: ChatSessionEntry;
  readonly onOpen: () => void;
};

const ORIGIN: Record<ChatSessionEntry['link']['kind'], string> = {
  new: 'started from this chat',
  add: 'added from this chat',
};

export const ChatSessionRow = ({ entry, onOpen }: Props) => {
  const title = sessionTitle({ session: entry.session });
  const now = useNow(30_000);
  const age = formatAge({ from: entry.link.createdAt, now });
  return (
    <div className="flex items-center gap-2.5 rounded-md p-2 hover:bg-hover">
      <StatusDot
        tone={STAGE_TONE[entry.stage]}
        pulsing={entry.stage === 'running'}
        ariaLabel={SESSION_STAGE_META[entry.stage].label}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label text-foreground">{title}</span>
        <span className="truncate text-secondary text-faint-foreground">
          {[SESSION_STAGE_META[entry.stage].label, `${ORIGIN[entry.link.kind]} ${age}`.trim()].join(
            ' · ',
          )}
        </span>
      </div>
      <Button variant="secondary" size="sm" aria-label={`Open ${title}`} onClick={onOpen}>
        Open
      </Button>
    </div>
  );
};
