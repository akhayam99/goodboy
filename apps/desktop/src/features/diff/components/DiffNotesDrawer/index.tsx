import { useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button, DrawerFrame, FilledEmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { openReview } from '../../../review/openReview';
import { DIFF_NOTES_LABEL } from '../../diffNotesCopy';
import { useNoteFixes } from '../../hooks/useNoteFixes';
import { NOTE_FIX_GROUPS } from '../../lib/noteFixes';
import { DiffNotesGroup } from './DiffNotesGroup';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const DiffNotesDrawer = ({ sessionId, onClose }: Props) => {
  const fixes = useNoteFixes({ sessionId });
  const [isDoneOpen, setIsDoneOpen] = useState(false);
  const groups = useMemo(
    () =>
      NOTE_FIX_GROUPS.map((group) => ({
        group,
        fixes: fixes.filter((fix) => fix.group === group),
      })).filter((entry) => entry.fixes.length > 0),
    [fixes],
  );

  return (
    <DrawerFrame
      title={DIFF_NOTES_LABEL.drawer}
      icon={MessageSquare}
      iconClassName="text-muted-foreground"
      count={fixes.length}
      closeLabel={DIFF_NOTES_LABEL.closeDrawer}
      onClose={onClose}
      action={
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
      }
    >
      {groups.length === 0 ? (
        <FilledEmptyState
          icon={CONCEPT_ICONS.diff}
          tone={CONCEPT_TONE.diff}
          title={DIFF_NOTES_LABEL.emptyTitle}
          description={DIFF_NOTES_LABEL.emptyDescription}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(({ group, fixes: inGroup }) => (
            <DiffNotesGroup
              key={group}
              sessionId={sessionId}
              group={group}
              fixes={inGroup}
              isOpen={group !== 'done' || isDoneOpen}
              onToggle={group === 'done' ? () => setIsDoneOpen((open) => !open) : null}
            />
          ))}
        </div>
      )}
    </DrawerFrame>
  );
};
