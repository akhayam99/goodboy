import { Eyebrow, ScrollFade } from '@goodboy/ui';
import { DEMO_GROUPS, type DemoChapter, type DemoChapterGroup } from './demoChapters';
import { DemoRailRow } from './DemoRailRow';

type SelectParams = {
  readonly id: string;
};

type Props = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly activeId: string;
  readonly visitedIds: ReadonlySet<string>;
  readonly onSelect: (params: SelectParams) => void;
};

const GROUP_ORDER: ReadonlyArray<DemoChapterGroup> = ['setup', 'flows'];

export const DemoRail = ({ chapters, activeId, visitedIds, onSelect }: Props) => (
  <nav aria-label="Chapters" className="hidden w-64 shrink-0 flex-col lg:flex">
    <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col gap-6 p-4" edge="line">
      {GROUP_ORDER.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <Eyebrow label={DEMO_GROUPS[group].label} muted className="px-3" />
          <div className="flex flex-col gap-0.5">
            {chapters.map((chapter, index) =>
              chapter.group === group ? (
                <DemoRailRow
                  key={chapter.id}
                  chapter={chapter}
                  ordinal={index + 1}
                  isActive={chapter.id === activeId}
                  isVisited={visitedIds.has(chapter.id)}
                  onSelect={() => onSelect({ id: chapter.id })}
                />
              ) : null,
            )}
          </div>
        </section>
      ))}
    </ScrollFade>
  </nav>
);
