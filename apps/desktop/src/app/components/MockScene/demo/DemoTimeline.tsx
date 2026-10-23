import { ArrowRight, ChevronLeft, Pause, Play, RotateCcw, Undo2 } from 'lucide-react';
import { Button, ICON_SIZE, IconButton } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { BeatFill, BeatPlayer } from './useBeatPlayer';
import { DemoBeatSegment } from './DemoBeatSegment';

type Props = {
  readonly chapter: DemoChapter;
  readonly player: BeatPlayer;
  readonly onReplay: () => void;
  readonly nextChapter: DemoChapter | undefined;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onRestart: () => void;
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
  nextChapter,
  hasPrevious,
  onPrevious,
  onNext,
  onRestart,
}: Props) => (
  <div className="flex items-center gap-2 sm:gap-4">
    <div className="flex shrink-0 items-center gap-1">
      <IconButton
        icon={ChevronLeft}
        label="Previous chapter"
        shortcut="←"
        size="md"
        disabled={!hasPrevious}
        onClick={onPrevious}
      />
      <IconButton
        icon={player.isPlaying ? Pause : Play}
        label={player.isPlaying ? 'Pause' : 'Play'}
        shortcut="Space"
        size="md"
        onClick={player.isPlaying ? player.pause : player.play}
      />
      <IconButton
        icon={RotateCcw}
        label="Replay chapter"
        shortcut="R"
        size="md"
        onClick={onReplay}
      />
    </div>
    <ol aria-label="Steps in this chapter" className="flex min-w-0 flex-1 items-stretch gap-1">
      {chapter.beats.map((beat, index) => (
        <li key={`${chapter.id}-${beat.label}`} className="flex min-w-0 flex-1">
          <DemoBeatSegment
            beat={beat}
            state={beatState({ index, current: player.beatIndex })}
            isRunning={player.isRunning && index === player.beatIndex}
            fill={index === player.beatIndex ? player.fill : IDLE_FILL}
            runKey={player.runKey}
            onSelect={() => player.goTo({ index })}
          />
        </li>
      ))}
    </ol>
    {nextChapter === undefined ? (
      <Button
        variant="secondary"
        size="md"
        aria-label="Back to the start"
        onClick={onRestart}
        className="shrink-0"
      >
        <Undo2 size={ICON_SIZE.control} />
        <span className="max-sm:hidden">Back to the start</span>
      </Button>
    ) : (
      <Button
        variant={player.isFinished ? 'primary' : 'secondary'}
        size="md"
        aria-label={`Next: ${nextChapter.title}`}
        onClick={onNext}
        className="shrink-0"
      >
        <span>
          Next<span className="max-sm:hidden">: {nextChapter.title}</span>
        </span>
        <ArrowRight size={ICON_SIZE.control} />
      </Button>
    )}
  </div>
);
