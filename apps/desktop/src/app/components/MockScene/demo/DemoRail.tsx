import { ScrollFade, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import { DemoRailRow, type UpNext } from './DemoRailRow';
import { DemoRailSteps } from './DemoRailSteps';
import { DemoRailActions } from './DemoRailActions';
import type { HintTally } from './hints/hintTally';
import type { StepVisits } from './hints/stepVisitsTypes';
import { quietClasses } from './quietClasses';

type SelectParams = {
  readonly id: string;
};

type StepParams = {
  readonly index: number;
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
  readonly beatIndex: number;
  readonly visits: StepVisits;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onSelect: (params: SelectParams) => void;
  readonly onSelectStep: (params: StepParams) => void;
  readonly onIntent: (params: SelectParams) => void;
  readonly upNextId: string | undefined;
  readonly isUpNextReady: boolean;
  readonly isQuiet: boolean;
};

export const DemoRail = ({
  chapters,
  activeId,
  beatIndex,
  visits,
  tallyOf,
  onSelect,
  onSelectStep,
  onIntent,
  upNextId,
  isUpNextReady,
  isQuiet,
}: Props) => (
  <div className="hidden w-64 shrink-0 flex-col gap-3 pb-5 lg:flex">
    <nav aria-label="Playground groups" className="flex min-h-0 flex-1 flex-col">
      <ScrollFade
        className="min-h-0 flex-1"
        viewportClassName="flex flex-col gap-1 p-4"
        edge="line"
      >
        {chapters.map((chapter, index) => {
          const isActive = chapter.id === activeId;
          const isRowQuiet = isQuiet && chapter.id !== upNextId && !isActive;
          return (
            <div
              key={chapter.id}
              data-quiet={isRowQuiet ? 'true' : 'false'}
              className={cn('flex flex-col gap-0.5', quietClasses({ isQuiet: isRowQuiet }))}
            >
              <DemoRailRow
                chapter={chapter}
                ordinal={index + 1}
                isActive={isActive}
                upNext={upNextOf({ isUpNext: chapter.id === upNextId, isReady: isUpNextReady })}
                tally={tallyOf({ chapter })}
                onSelect={() => onSelect({ id: chapter.id })}
                onIntent={() => onIntent({ id: chapter.id })}
              />
              {isActive ? (
                <DemoRailSteps
                  chapter={chapter}
                  beatIndex={beatIndex}
                  seen={visits[chapter.id] ?? []}
                  onSelect={onSelectStep}
                />
              ) : null}
            </div>
          );
        })}
      </ScrollFade>
    </nav>
    <div className="flex flex-col gap-3 px-4">
      <DemoRailActions />
    </div>
  </div>
);
