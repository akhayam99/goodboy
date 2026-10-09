import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { openNoteCountOf } from '../../resolve/notes/notesOnBranchOf';
import { reviewNotesDrawer } from '../../resolve/notes/notesDrawer';
import { notesButtonLabel } from '../../resolve/notes/reviewNotesCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const NotesButton = ({ sessionId, mountPath }: Props) => {
  const count = useAppStore((s) => openNoteCountOf({ state: s, sessionId }));
  const isOpen = useAppStore((s) => selectOpenDrawer(s)?.kind === 'review-notes');
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  if (count === 0) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-pressed={isOpen}
      onClick={() => toggleDrawer(reviewNotesDrawer({ sessionId, mountPath }))}
    >
      {notesButtonLabel({ count })}
    </Button>
  );
};
