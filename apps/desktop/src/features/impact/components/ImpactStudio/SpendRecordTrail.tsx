import { tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';

type Props = {
  readonly label: string;
  readonly onImpact: () => void;
  readonly onSpend: () => void;
};

export const SpendRecordTrail = ({ label, onImpact, onSpend }: Props) => (
  <StudioTrail
    segments={[
      {
        id: 'impact',
        label: 'Impact',
        icon: CONCEPT_ICONS.impact,
        iconClassName: tintClasses(CONCEPT_TONE.impact).icon,
        onSelect: onImpact,
      },
      { id: 'spend', label: 'Spend', icon: CONCEPT_ICONS.budget, onSelect: onSpend },
      { id: 'record', label, icon: CONCEPT_ICONS.budget },
    ]}
  />
);
