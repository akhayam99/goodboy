import type { DemoChapter } from './demoChapters';
import { DemoRailStep } from './DemoRailStep';
import { stepStateOf } from './stepStateOf';

type SelectParams = {
  readonly index: number;
};

type Props = {
  readonly chapter: DemoChapter;
  readonly beatIndex: number;
  readonly seen: ReadonlyArray<number>;
  readonly onSelect: (params: SelectParams) => void;
};

export const DemoRailSteps = ({ chapter, beatIndex, seen, onSelect }: Props) => (
  <ol aria-label="Steps in this group" className="flex flex-col gap-0.5 pl-8">
    {chapter.beats.map((beat, index) => (
      <li key={`${chapter.id}-${beat.label}`}>
        <DemoRailStep
          label={beat.label}
          state={stepStateOf({ index, current: beatIndex, seen })}
          onSelect={() => onSelect({ index })}
        />
      </li>
    ))}
  </ol>
);
