import { Chip } from '@goodboy/ui';
import type { HandoffSection, HandoffSectionKind } from '@goodboy/types';
import { handoffChipLabel } from '../../utils/handoffLabels';

type Props = {
  readonly sections: ReadonlyArray<HandoffSection>;
  readonly onOpenSection: (kind: HandoffSectionKind) => void;
};

export const HandoffChips = ({ sections, onOpenSection }: Props) => {
  if (sections.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5" data-testid="handoff-chips">
      {sections.map((section) => (
        <Chip
          key={section.kind}
          tone="neutral"
          emphasis="subtle"
          label={handoffChipLabel({ section })}
          onClick={() => onOpenSection(section.kind)}
        />
      ))}
    </div>
  );
};
