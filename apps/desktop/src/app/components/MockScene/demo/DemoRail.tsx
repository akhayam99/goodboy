import { ScrollFade } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import { DemoRailRow } from './DemoRailRow';
import type { HintTally } from './hints/hintTally';

type SelectParams = {
  readonly id: string;
};

type TallyParams = {
  readonly chapter: DemoChapter;
};

type Props = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly activeId: string;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onSelect: (params: SelectParams) => void;
};

export const DemoRail = ({ chapters, activeId, tallyOf, onSelect }: Props) => (
  <nav aria-label="Playground groups" className="hidden w-64 shrink-0 flex-col lg:flex">
    <ScrollFade
      className="min-h-0 flex-1"
      viewportClassName="flex flex-col gap-0.5 p-4"
      edge="line"
    >
      {chapters.map((chapter, index) => (
        <DemoRailRow
          key={chapter.id}
          chapter={chapter}
          ordinal={index + 1}
          isActive={chapter.id === activeId}
          tally={tallyOf({ chapter })}
          onSelect={() => onSelect({ id: chapter.id })}
        />
      ))}
    </ScrollFade>
  </nav>
);
