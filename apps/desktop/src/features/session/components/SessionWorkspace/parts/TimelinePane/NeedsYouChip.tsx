import { Chip } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly count: number;
  readonly onReveal: () => void;
};

export const NeedsYouChip = ({ count, onReveal }: Props) => {
  if (count === 0) {
    return null;
  }
  return (
    <Chip
      as="button"
      tone="warning"
      size="control"
      emphasis="subtle"
      icon={<CONCEPT_ICONS.questions size={ICON_SIZE.row} aria-hidden className="shrink-0" />}
      label={`${count} ${count === 1 ? 'needs' : 'need'} you`}
      onClick={onReveal}
    />
  );
};
