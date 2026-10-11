import { Button, OverflowMenu } from '@goodboy/ui';
import { REVIEW_NOTES_COPY } from '../../reviewNotesCopy';

type Props = {
  readonly moveLabel: string | null;
  readonly isClosedShown: boolean;
  readonly onMove: () => void;
  readonly onToggleClosed: () => void;
};

export const ReviewNotesMenu = ({ moveLabel, isClosedShown, onMove, onToggleClosed }: Props) => {
  const closedLabel = isClosedShown ? REVIEW_NOTES_COPY.hideClosed : REVIEW_NOTES_COPY.showClosed;
  if (moveLabel === null) {
    return (
      <Button size="sm" variant="ghost" aria-pressed={isClosedShown} onClick={onToggleClosed}>
        {closedLabel}
      </Button>
    );
  }
  return (
    <OverflowMenu
      label={REVIEW_NOTES_COPY.moreActions}
      size="control"
      items={[
        { kind: 'item', key: 'move', label: moveLabel, onClick: onMove },
        { kind: 'item', key: 'closed', label: closedLabel, onClick: onToggleClosed },
      ]}
    />
  );
};
