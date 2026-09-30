import { Layers } from 'lucide-react';
import { AnchoredPopover, Eyebrow, StatusDot, cn, useDropdown } from '@goodboy/ui';
import type { SessionId, SessionStage } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import { STAGE_TONE } from '../../../session/session-stage';
import type { ChatSessionEntry } from '../../chatSessionEntries';
import { ChatSessionRow } from './ChatSessionRow';

type Props = {
  readonly entries: ReadonlyArray<ChatSessionEntry>;
  readonly stage: SessionStage;
  readonly onOpen: (sessionId: SessionId) => void;
};

export const CHAT_SESSIONS_LABEL = 'Linked sessions';

export const ChatSessionsChip = ({ entries, stage, onOpen }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    expectedWidth: 384,
    expectedHeight: 180,
  });
  const label = pluralize(entries.length, 'session');

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={CHAT_SESSIONS_LABEL}
      className="gap-0.5 p-1.5"
      trigger={
        <button
          type="button"
          onClick={dropdown.toggle}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={`${label}: ${CHAT_SESSIONS_LABEL}`}
          className={cn(
            'flex h-6 shrink-0 items-center gap-1 rounded-md border border-border-soft bg-subtle px-2 text-secondary text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            dropdown.open && 'bg-hover text-foreground',
          )}
        >
          <Layers size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
          {label}
          <StatusDot tone={STAGE_TONE[stage]} size="sm" pulsing={stage === 'running'} />
        </button>
      }
    >
      <Eyebrow label={CHAT_SESSIONS_LABEL} className="px-2 pb-1 pt-1.5" />
      {entries.map((entry) => (
        <ChatSessionRow
          key={entry.link.id}
          entry={entry}
          onOpen={() => {
            dropdown.close();
            onOpen(entry.session.id);
          }}
        />
      ))}
    </AnchoredPopover>
  );
};
