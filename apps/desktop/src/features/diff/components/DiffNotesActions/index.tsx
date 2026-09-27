import { MessageSquare } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { DiffComment, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openReview } from '../../../review/openReview';

type Props = {
  readonly sessionId: SessionId;
  readonly openNotes: ReadonlyArray<DiffComment>;
};

export const RESOLVE_IN_REVIEW_LABEL = 'Resolve in Review';

export const notesCountLabel = ({ count }: { readonly count: number }): string =>
  `${count} ${count === 1 ? 'note' : 'notes'}`;

export const DiffNotesActions = ({ sessionId, openNotes }: Props) => {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const isDrawerOpen = useAppStore((s) => selectOpenDrawer(s)?.kind === 'diff-notes');
  const count = openNotes.length;

  return (
    <div data-slot="diff-notes-actions" className="flex min-w-0 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isDrawerOpen}
        onClick={() => toggleDrawer({ kind: 'diff-notes', sessionId, payload: {} })}
      >
        <MessageSquare size={ICON_SIZE.row} aria-hidden />
        {notesCountLabel({ count })}
      </Button>
      <Button size="sm" onClick={() => void openReview({ sessionId })} disabled={count === 0}>
        {RESOLVE_IN_REVIEW_LABEL}
      </Button>
    </div>
  );
};
