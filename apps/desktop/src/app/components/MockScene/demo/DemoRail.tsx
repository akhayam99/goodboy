import { ScrollFade } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import { DemoRailRow, type UpNext } from './DemoRailRow';
import { DemoRailNote } from './DemoRailNote';
import { DemoRailActions } from './DemoRailActions';
import type { HintTally } from './hints/hintTally';

type SelectParams = {
  readonly id: string;
};

type TallyParams = {
  readonly chapter: DemoChapter;
};

type UpNextParams = {
  readonly isUpNext: boolean;
  readonly isReady: boolean;
};

const upNextOf = ({ isUpNext, isReady }: UpNextParams): UpNext => {
  if (!isUpNext) {
    return 'none';
  }
  return isReady ? 'ready' : 'soon';
};

type Props = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly activeId: string;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onSelect: (params: SelectParams) => void;
  readonly isEveryGroupTried: boolean;
  readonly upNextId: string | undefined;
  readonly isUpNextReady: boolean;
};

export const DemoRail = ({
  chapters,
  activeId,
  tallyOf,
  onSelect,
  isEveryGroupTried,
  upNextId,
  isUpNextReady,
}: Props) => (
  <div className="hidden w-64 shrink-0 flex-col gap-3 pb-5 lg:flex">
    <nav aria-label="Playground groups" className="flex min-h-0 flex-1 flex-col">
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
            upNext={upNextOf({ isUpNext: chapter.id === upNextId, isReady: isUpNextReady })}
            tally={tallyOf({ chapter })}
            onSelect={() => onSelect({ id: chapter.id })}
          />
        ))}
      </ScrollFade>
    </nav>
    <div className="flex flex-col gap-3 px-4">
      <DemoRailNote isEveryGroupTried={isEveryGroupTried} />
      <DemoRailActions />
    </div>
  </div>
);
