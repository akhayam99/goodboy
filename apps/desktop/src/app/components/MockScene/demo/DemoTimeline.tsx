import { useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { BeatFill, BeatPlayer } from './useBeatPlayer';
import { DemoBeatSegment } from './DemoBeatSegment';
import { useUpNextBreath } from './useUpNextBreath';

type Props = {
  readonly chapter: DemoChapter;
  readonly player: BeatPlayer;
  readonly onReplay: () => void;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly next: DemoChapter | undefined;
  readonly isNextReady: boolean;
  readonly onNext: () => void;
};

const IDLE_FILL: BeatFill = { totalMs: 0, startMs: 0 };

type BeatStateParams = {
  readonly index: number;
  readonly current: number;
};

const beatState = ({ index, current }: BeatStateParams): 'past' | 'current' | 'next' => {
  if (index < current) {
    return 'past';
  }
  return index === current ? 'current' : 'next';
};

export const DemoTimeline = ({
  chapter,
  player,
  onReplay,
  hasPrevious,
  onPrevious,
  next,
  isNextReady,
  onNext,
}: Props) => {
  const nextRef = useRef<HTMLSpanElement>(null);
  const isPulsing = useUpNextBreath({ targetRef: nextRef, isReady: isNextReady });
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          label="Previous group"
          shortcut="←"
          size="md"
          disabled={!hasPrevious}
          onClick={onPrevious}
        />
        <IconButton
          icon={RotateCcw}
          label="Replay group"
          shortcut="R"
          size="md"
          onClick={onReplay}
        />
      </div>
      <ol aria-label="Steps in this group" className="flex min-w-0 flex-1 items-stretch gap-1">
        {chapter.beats.map((beat, index) => (
          <li key={`${chapter.id}-${beat.label}`} className="flex min-w-0 flex-1">
            <DemoBeatSegment
              beat={beat}
              state={beatState({ index, current: player.beatIndex })}
              isRunning={player.isRunning && index === player.beatIndex}
              isComplete={player.isComplete && index === player.beatIndex}
              fill={index === player.beatIndex ? player.fill : IDLE_FILL}
              runKey={player.runKey}
              onSelect={() => player.goTo({ index })}
            />
          </li>
        ))}
      </ol>
      {next === undefined ? null : (
        <span
          ref={nextRef}
          data-up-next={isNextReady ? 'ready' : 'soon'}
          data-pulsing={isPulsing ? 'true' : 'false'}
          className="shrink-0 rounded-md lg:hidden"
        >
          <IconButton
            icon={ChevronRight}
            label="Next group"
            tooltip={`Next group: ${next.title}`}
            shortcut="→"
            size="md"
            onClick={onNext}
          />
        </span>
      )}
    </div>
  );
};
