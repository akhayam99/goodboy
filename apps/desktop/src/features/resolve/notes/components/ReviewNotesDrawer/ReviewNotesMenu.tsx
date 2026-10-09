import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { REVIEW_NOTES_COPY } from '../../reviewNotesCopy';

type Props = {
  readonly moveLabel: string | null;
  readonly isClosedShown: boolean;
  readonly onMove: () => void;
  readonly onToggleClosed: () => void;
};

export const ReviewNotesMenu = ({ moveLabel, isClosedShown, onMove, onToggleClosed }: Props) => {
  const items: ReadonlyArray<OverflowMenuItem> = [
    ...(moveLabel === null
      ? []
      : [{ kind: 'item' as const, key: 'move', label: moveLabel, onClick: onMove }]),
    {
      kind: 'item',
      key: 'closed',
      label: isClosedShown ? REVIEW_NOTES_COPY.hideClosed : REVIEW_NOTES_COPY.showClosed,
      onClick: onToggleClosed,
    },
  ];
  return <OverflowMenu items={items} label={REVIEW_NOTES_COPY.moreActions} size="control" />;
};
