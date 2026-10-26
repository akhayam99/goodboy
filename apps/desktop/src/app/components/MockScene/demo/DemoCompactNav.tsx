import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FOCUS_RING, IconButton, ScrollFade, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import { stepStateOf } from './stepStateOf';
import { useUpNextBreath } from './useUpNextBreath';

type StepParams = {
  readonly index: number;
};

type Props = {
  readonly title: string;
  readonly chapter: DemoChapter | undefined;
  readonly groupNumber: number;
  readonly groupCount: number;
  readonly beatIndex: number;
  readonly seen: ReadonlyArray<number>;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly nextTitle: string | undefined;
  readonly isNextReady: boolean;
  readonly onNext: () => void;
  readonly onSelectStep: (params: StepParams) => void;
};

export const DemoCompactNav = ({
  title,
  chapter,
  groupNumber,
  groupCount,
  beatIndex,
  seen,
  hasPrevious,
  onPrevious,
  nextTitle,
  isNextReady,
  onNext,
  onSelectStep,
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
            data-up-next={isNextReady ? 'ready' : 'soon'}
            data-pulsing={isPulsing ? 'true' : 'false'}
            className="shrink-0 rounded-md"
          >
            <IconButton
              icon={ChevronRight}
              label="Next group"
              tooltip={`Next: ${nextTitle}`}
              shortcut="→"
              size="md"
              onClick={onNext}
            />
          </span>
        )}
      </div>
      {chapter === undefined ? null : (
        <ScrollFade
          className="min-w-0"
          viewportClassName="flex gap-1"
          orientation="horizontal"
          edge="line"
        >
          <ol aria-label="Switch step" className="flex gap-1">
            {chapter.beats.map((beat, index) => {
              const state = stepStateOf({ index, current: beatIndex, seen });
              return (
                <li key={`${chapter.id}-${beat.label}`} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectStep({ index })}
                    aria-current={state === 'current' ? 'step' : undefined}
                    data-state={state}
                    className={cn(
                      'rounded-md px-3 py-2 text-label text-muted-foreground hover:bg-hover',
                      FOCUS_RING,
                      'data-[state=current]:bg-selected data-[state=current]:text-foreground',
                    )}
                  >
                    {beat.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </ScrollFade>
      )}
    </nav>
  );
};
