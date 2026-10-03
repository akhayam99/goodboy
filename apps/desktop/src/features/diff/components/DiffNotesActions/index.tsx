import { MessageSquare } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openReview } from '../../../review/openReview';
import type { NoteFix } from '../../lib/noteFixes';
import { DIFF_NOTES_LABEL, fixNotesLabel, notesCountLabel } from '../../diffNotesCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly fixes: ReadonlyArray<NoteFix>;
};

export const DiffNotesActions = ({ sessionId, fixes }: Props) => {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const showDiffNoteLaunch = useAppStore((s) => s.showDiffNoteLaunch);
  const isDrawerOpen = useAppStore((s) => selectOpenDrawer(s)?.kind === 'diff-notes');
  const count = fixes.filter((fix) => fix.group !== 'done').length;
  const fixable = fixes.filter((fix) => fix.canFix && fix.group === 'open');

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
      <Button
        variant="secondary"
        emphasis="outline"
        size="sm"
        onClick={() =>
          void openReview({ sessionId, destination: { kind: 'notes', threadIds: [] } })
        }
      >
        {DIFF_NOTES_LABEL.openInReview}
      </Button>
      <Button
        size="sm"
        disabled={fixable.length === 0}
        onClick={() =>
          showDiffNoteLaunch({ sessionId, threadIds: fixable.map((fix) => fix.threadId) })
        }
      >
        {fixNotesLabel({ count: fixable.length })}
      </Button>
    </div>
  );
};
