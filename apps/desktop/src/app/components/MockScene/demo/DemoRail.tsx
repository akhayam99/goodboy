import { Download } from 'lucide-react';
import { ScrollFade, WORK_NODE_GLYPH_SIZE, cn } from '@goodboy/ui';
import { CLOSING_ID } from './closingId';
import { CLOSING_TITLE } from './closingTitle';
import type { DemoChapter } from './demoChapters';
import { DemoRailGroupRow } from './DemoRailGroupRow';
import { DemoRailStep, type StepState } from './DemoRailStep';
import { demoRailOf, type DemoRailNode } from './demoRailOf';
import type { Access } from './hints/groupAccessOf';
import type { HintTally } from './hints/hintTally';
import type { Steps } from './hints/stepsOf';
import { quietClasses } from './quietClasses';

type SelectParams = {
  readonly id: string;
};

type TallyParams = {
  readonly chapter: DemoChapter;
};

type StateParams = {
  readonly steps: Steps;
  readonly id: string;
  readonly index: number;
};

const stepStateOf = ({ steps, id, index }: StateParams): StepState => {
  if (steps.doneIds.has(id)) {
    return 'done';
  }
  return index === steps.activeIndex ? 'current' : 'todo';
};

type Props = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly activeId: string;
  readonly access: Access;
  readonly steps: Steps;
  readonly tallyOf: (params: TallyParams) => HintTally;
  readonly onSelect: (params: SelectParams) => void;
  readonly onIntent: (params: SelectParams) => void;
  readonly upNextId: string | undefined;
  readonly isQuiet: boolean;
};

type NodeParams = {
  readonly chapterId: string;
};

const groupNodeOf = ({ chapterId }: NodeParams): string => `group:${chapterId}`;

export const DemoRail = ({
  chapters,
  activeId,
  access,
  steps,
  tallyOf,
  onSelect,
  onIntent,
  upNextId,
  isQuiet,
}: Props) => {
  const active = chapters.find((chapter) => chapter.id === activeId);
  const nodes: ReadonlyArray<DemoRailNode> = [
    ...chapters.flatMap((chapter): ReadonlyArray<DemoRailNode> => [
      { id: groupNodeOf({ chapterId: chapter.id }), laneOf: null, isPending: false },
      ...(chapter.id === activeId
        ? chapter.hints.map((hint, index) => ({
            id: `step:${hint.id}`,
            laneOf: groupNodeOf({ chapterId: chapter.id }),
            isPending: stepStateOf({ steps, id: hint.id, index }) === 'todo',
          }))
        : []),
    ]),
    { id: groupNodeOf({ chapterId: CLOSING_ID }), laneOf: null, isPending: false },
  ];
  const rail = demoRailOf({ nodes });
  const closingRail = rail.railById.get(groupNodeOf({ chapterId: CLOSING_ID }));
  const isClosingQuiet = isQuiet && upNextId !== CLOSING_ID && activeId !== CLOSING_ID;
  return (
    <div className="hidden w-64 shrink-0 flex-col pb-5 lg:flex">
      <nav aria-label="Playground groups" className="flex min-h-0 flex-1 flex-col">
        <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col p-4" edge="line">
          {chapters.map((chapter, index) => {
            const isActive = chapter.id === activeId;
            const rowRail = rail.railById.get(groupNodeOf({ chapterId: chapter.id }));
            const isRowQuiet = isQuiet && chapter.id !== upNextId && !isActive;
            if (rowRail === undefined) {
              return null;
            }
            return (
              <div
                key={chapter.id}
                data-quiet={isRowQuiet ? 'true' : 'false'}
                className={cn('flex flex-col', quietClasses({ isQuiet: isRowQuiet }))}
              >
                <DemoRailGroupRow
                  title={chapter.title}
                  mark={{ kind: 'index', value: String(index + 1) }}
                  rail={rowRail}
                  railWidth={rail.width}
                  access={access.groups.get(chapter.id) ?? 'locked'}
                  isOptional={chapter.isOptional === true}
                  isActive={isActive}
                  isUpNext={chapter.id === upNextId}
                  tally={tallyOf({ chapter })}
                  onSelect={() => onSelect({ id: chapter.id })}
                  onIntent={() => onIntent({ id: chapter.id })}
                />
                {isActive && active !== undefined ? (
                  <ol aria-label="Steps in this group" className="flex flex-col">
                    {active.hints.map((hint, hintIndex) => {
                      const stepRail = rail.railById.get(`step:${hint.id}`);
                      return stepRail === undefined ? null : (
                        <DemoRailStep
                          key={hint.id}
                          label={hint.label}
                          state={stepStateOf({ steps, id: hint.id, index: hintIndex })}
                          rail={stepRail}
                          railWidth={rail.width}
                        />
                      );
                    })}
                  </ol>
                ) : null}
              </div>
            );
          })}
          <div
            data-quiet={isClosingQuiet ? 'true' : 'false'}
            className={quietClasses({ isQuiet: isClosingQuiet })}
          >
            {closingRail === undefined ? null : (
              <DemoRailGroupRow
                title={CLOSING_TITLE}
                mark={{
                  kind: 'glyph',
                  glyph: <Download size={WORK_NODE_GLYPH_SIZE} aria-hidden />,
                }}
                rail={closingRail}
                railWidth={rail.width}
                access={access.closing}
                isActive={activeId === CLOSING_ID}
                isUpNext={upNextId === CLOSING_ID}
                onSelect={() => onSelect({ id: CLOSING_ID })}
                onIntent={() => onIntent({ id: CLOSING_ID })}
              />
            )}
          </div>
        </ScrollFade>
      </nav>
    </div>
  );
};
