import { Chip, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export const ExperimentalPill = () => {
  const Icon = CONCEPT_ICONS.work;
  return (
    <Chip
      tone="neutral"
      kind="state"
      emphasis="subtle"
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label="Experimental"
    />
  );
};
