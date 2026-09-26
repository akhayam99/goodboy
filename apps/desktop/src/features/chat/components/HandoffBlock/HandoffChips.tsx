import { ChevronDown } from 'lucide-react';
import { Chip, cn } from '@goodboy/ui';
import type { HandoffSection, HandoffSectionKind } from '@goodboy/types';
import { handoffChipLabel } from '../../utils/handoffLabels';
import type { HandoffActive } from './useHandoffDisclosure';

type Props = {
  readonly sections: ReadonlyArray<HandoffSection>;
  readonly active: HandoffActive;
  readonly onToggleSection: (kind: HandoffSectionKind) => void;
  readonly onShowAll: () => void;
};

export const handoffChipTestId = (kind: HandoffSectionKind | 'all'): string =>
  `handoff-chip-${kind}`;

export const HandoffChips = ({ sections, active, onToggleSection, onShowAll }: Props) => {
  if (sections.length === 0) {
    return null;
  }
  return (
    <div
      role="toolbar"
      aria-label="Sections received"
      className="flex min-w-0 flex-wrap gap-1.5"
      data-testid="handoff-chips"
    >
      {sections.map((section) => {
        const isPressed = active === section.kind;
        return (
          <Chip
            key={section.kind}
            as="button"
            testId={handoffChipTestId(section.kind)}
            tone="neutral"
            emphasis="subtle"
            ariaPressed={isPressed}
            label={handoffChipLabel({ section })}
            trailing={
              <ChevronDown
                size={10}
                aria-hidden
                className={cn('motion-safe:transition-transform', isPressed && 'rotate-180')}
              />
            }
            className={isPressed ? 'bg-selected text-foreground' : undefined}
            onClick={() => onToggleSection(section.kind)}
          />
        );
      })}
      <Chip
        as="button"
        testId={handoffChipTestId('all')}
        tone="neutral"
        emphasis="subtle"
        ariaPressed={active === 'all'}
        label="All"
        className={active === 'all' ? 'bg-selected text-foreground' : undefined}
        onClick={onShowAll}
      />
    </div>
  );
};
