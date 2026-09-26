import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, ScrollArea } from '@goodboy/ui';
import type { HandoffSection, HandoffSectionKind, SessionId } from '@goodboy/types';
import { HANDOFF_SECTION_LABEL } from '../../utils/handoffLabels';
import { HandoffSectionBody } from './HandoffSectionBody';
import { handoffChipTestId } from './HandoffChips';

type Props = {
  readonly section: HandoffSection;
  readonly index: number;
  readonly total: number;
  readonly doneWhen: string | null;
  readonly sessionId: SessionId | null;
  readonly onStep: (delta: number) => void;
  readonly onClose: () => void;
};

const focusChip = (kind: HandoffSectionKind): void => {
  const chip = document.querySelector<HTMLButtonElement>(
    `[data-testid="${handoffChipTestId(kind)}"]`,
  );
  chip?.focus();
};

export const HandoffPanel = ({
  section,
  index,
  total,
  doneWhen,
  sessionId,
  onStep,
  onClose,
}: Props) => (
  <div
    role="region"
    aria-label={HANDOFF_SECTION_LABEL[section.kind]}
    data-testid={`handoff-section-${section.kind}`}
    onKeyDown={(event) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.stopPropagation();
      onClose();
      focusChip(section.kind);
    }}
    className="flex min-w-0 flex-col gap-2 rounded-md bg-subtle p-3"
  >
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-label text-foreground">
        {HANDOFF_SECTION_LABEL[section.kind]}
      </span>
      <span className="min-w-0 flex-1 truncate text-secondary text-faint-foreground">
        {section.summary}
      </span>
      {total > 1 ? (
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-secondary text-muted-foreground">
            {index + 1} of {total}
          </span>
          <IconButton
            icon={ChevronLeft}
            label="Previous section"
            iconSize={12}
            variant="ghost"
            onClick={() => onStep(-1)}
          />
          <IconButton
            icon={ChevronRight}
            label="Next section"
            iconSize={12}
            variant="ghost"
            onClick={() => onStep(1)}
          />
        </div>
      ) : null}
    </div>
    <ScrollArea className="max-h-80">
      <HandoffSectionBody section={section} doneWhen={doneWhen} sessionId={sessionId} />
    </ScrollArea>
  </div>
);
