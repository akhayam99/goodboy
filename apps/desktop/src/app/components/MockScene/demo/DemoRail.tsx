import { ScrollFade, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import { DemoRailRow, type UpNext } from './DemoRailRow';
import { DemoRailNote } from './DemoRailNote';
import { DemoRailActions } from './DemoRailActions';
import type { HintTally } from './hints/hintTally';
import { quietClasses } from './quietClasses';

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
  readonly onIntent: (params: SelectParams) => void;
  readonly isEveryGroupTried: boolean;
  readonly upNextId: string | undefined;
  readonly isUpNextReady: boolean;
  readonly isQuiet: boolean;
};

export const DemoRail = ({
  chapters,
  activeId,
  tallyOf,
  onSelect,
  onIntent,
  isEveryGroupTried,
  upNextId,
  isUpNextReady,
  isQuiet,
}: Props) => (
  <div className="hidden w-64 shrink-0 flex-col gap-3 pb-5 lg:flex">
    <nav aria-label="Playground groups" className="flex min-h-0 flex-1 flex-col">
      <ScrollFade
        className="min-h-0 flex-1"
        viewportClassName="flex flex-col gap-0.5 p-4"
        edge="line"
      >
        {chapters.map((chapter, index) => {
          const isRowQuiet = isQuiet && chapter.id !== upNextId && chapter.id !== activeId;
          return (
            <div
              key={chapter.id}
              data-quiet={isRowQuiet ? 'true' : 'false'}
              className={cn('flex flex-col gap-2', quietClasses({ isQuiet: isRowQuiet }))}
            >
              <DemoRailRow
                chapter={chapter}
                ordinal={index + 1}
                isActive={chapter.id === activeId}
                upNext={upNextOf({ isUpNext: chapter.id === upNextId, isReady: isUpNextReady })}
                tally={tallyOf({ chapter })}
                onSelect={() => onSelect({ id: chapter.id })}
                onIntent={() => onIntent({ id: chapter.id })}
              />
            </div>
          );
        })}
      </ScrollFade>
    </nav>
    <div className="flex flex-col gap-3 px-4">
      <DemoRailNote isEveryGroupTried={isEveryGroupTried} />
      <DemoRailActions />
    </div>
  </div>
);
