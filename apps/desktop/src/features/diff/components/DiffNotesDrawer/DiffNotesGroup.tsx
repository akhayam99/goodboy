import { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  NOTE_FIX_GROUP_LABEL,
  NOTE_FIX_GROUP_TONE,
  type NoteFix,
  type NoteFixGroup,
} from '../../lib/noteFixes';
import { DiffNotesRow } from './DiffNotesRow';

type Props = {
  readonly sessionId: SessionId;
  readonly group: NoteFixGroup;
  readonly fixes: ReadonlyArray<NoteFix>;
  readonly isOpen: boolean;
  readonly onToggle: (() => void) | null;
};

const HEADER_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-label text-foreground';

export const DiffNotesGroup = ({ sessionId, group, fixes, isOpen, onToggle }: Props) => {
  const listId = useId();
  const label = NOTE_FIX_GROUP_LABEL[group];
  const heading = (
    <>
      <StatusDot tone={NOTE_FIX_GROUP_TONE[group]} size="sm" />
      <span>{label}</span>
      <span className="text-meta text-faint-foreground">{fixes.length}</span>
    </>
  );

  return (
    <section aria-label={label} data-group={group} className="flex flex-col gap-0.5">
      {onToggle === null ? (
        <h3 className={HEADER_CLASS}>{heading}</h3>
      ) : (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={onToggle}
          className={cn(HEADER_CLASS, 'text-left hover:bg-hover')}
        >
          {heading}
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'ml-auto text-faint-foreground transition-transform',
              isOpen && 'rotate-90',
            )}
          />
        </button>
      )}
      {isOpen ? (
        <ul id={listId} className="flex flex-col">
          {fixes.map((fix) => (
            <DiffNotesRow key={fix.note.id} sessionId={sessionId} fix={fix} />
          ))}
        </ul>
      ) : null}
    </section>
  );
};
