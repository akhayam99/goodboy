import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { Steps } from './hints/stepsOf';
import { useUpNextBreath } from './useUpNextBreath';

type Props = {
  readonly title: string;
  readonly chapter: DemoChapter | undefined;
  readonly groupNumber: number;
  readonly groupCount: number;
  readonly steps: Steps;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly nextTitle: string | undefined;
  readonly isNextReady: boolean;
  readonly isNextLocked: boolean;
  readonly onNext: () => void;
};

export const DemoCompactNav = ({
  title,
  chapter,
  groupNumber,
  groupCount,
  steps,
  hasPrevious,
  onPrevious,
  nextTitle,
  isNextReady,
  isNextLocked,
  onNext,
}: Props) => {
  const nextRef = useRef<HTMLSpanElement>(null);
  const isPulsing = useUpNextBreath({ targetRef: nextRef, isReady: isNextReady });
  return (
    <nav aria-label="Playground navigation" className="flex flex-col gap-2 lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <IconButton
          icon={ChevronLeft}
          label="Previous group"
          shortcut="←"
          size="md"
          disabled={!hasPrevious}
          onClick={onPrevious}
        />
        <p className="min-w-0 truncate text-ui text-muted-foreground">
          <span className="text-foreground">{title}</span>{' '}
          {chapter === undefined ? null : `${groupNumber} of ${groupCount}`}
        </p>
        {nextTitle === undefined ? null : (
          <span
            ref={nextRef}
            data-up-next={isNextReady ? 'ready' : 'none'}
            data-pulsing={isPulsing ? 'true' : 'false'}
            className="shrink-0 rounded-md"
          >
            <IconButton
              icon={ChevronRight}
              label="Next group"
              tooltip={
                isNextLocked ? `${nextTitle} unlocks when this group is done` : `Next: ${nextTitle}`
              }
              shortcut="→"
              size="md"
              disabled={isNextLocked}
              onClick={onNext}
            />
          </span>
        )}
      </div>
      {chapter === undefined || steps.activeHint === undefined ? null : (
        <p aria-label="Current step" className="text-meta text-muted-foreground">
          Step {steps.activeIndex + 1} of {chapter.hints.length}: {steps.activeHint.label}
        </p>
      )}
    </nav>
  );
};
