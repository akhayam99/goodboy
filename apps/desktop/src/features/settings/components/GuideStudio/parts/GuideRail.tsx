import { EmptyLine, Eyebrow, ScrollFade, SelectableRow } from '@goodboy/ui';
import { RailSearch, type RailSearchStep } from '../../../../../shared/components/RailSearch';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { GUIDE_CHAPTERS, GUIDE_GROUP_LABEL, GUIDE_GROUP_ORDER } from '../guideChapters';
import { queryWordsOf } from '../queryWordsOf';
import type { GuideHit } from '../searchChapters';
import { HitLabel } from './HitLabel';

type Props = {
  readonly chapterId: string;
  readonly query: string;
  readonly hits: ReadonlyArray<GuideHit>;
  readonly activeHit: number;
  readonly onQueryChange: (query: string) => void;
  readonly onStep: (step: RailSearchStep) => void;
  readonly onSubmit: () => void;
  readonly onOpenChapter: (id: string) => void;
  readonly onOpenHit: (hit: GuideHit) => void;
};

export const GuideRail = ({
  chapterId,
  query,
  hits,
  activeHit,
  onQueryChange,
  onStep,
  onSubmit,
  onOpenChapter,
  onOpenHit,
}: Props) => {
  const words = queryWordsOf({ query });
  const isSearching = words.length > 0;
  return (
    <nav aria-label="Guide chapters" className="flex min-h-0 flex-1 flex-col gap-2 pt-3">
      <div className="px-3">
        <RailSearch
          label="Search the guide"
          value={query}
          onChange={onQueryChange}
          onSubmit={onSubmit}
          onStep={onStep}
        />
      </div>
      <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
        <div className="flex flex-col gap-2 px-3 pb-3">
          {isSearching ? (
            <div className="flex flex-col gap-0.5">
              {hits.length === 0 ? (
                <EmptyLine className="px-2 py-1 text-ui text-faint-foreground">
                  No chapter matches "{query.trim()}".
                </EmptyLine>
              ) : (
                <Eyebrow label={pluralize(hits.length, 'result')} className="px-2 py-1" />
              )}
              <ul aria-label="Guide results" className="flex flex-col gap-0.5 empty:hidden">
                {hits.map((hit, index) => (
                  <li key={hit.key}>
                    <SelectableRow
                      selected={index === activeHit}
                      ariaLabel={`${hit.term ?? hit.chapterTitle}, ${hit.term === null ? 'Chapter' : hit.chapterTitle}`}
                      onClick={() => onOpenHit(hit)}
                      className="flex-col items-start gap-0 px-2 py-1"
                    >
                      <span className="w-full truncate text-ui text-foreground">
                        <HitLabel text={hit.term ?? hit.chapterTitle} words={words} />
                      </span>
                      <span className="w-full truncate text-ui text-faint-foreground">
                        {hit.term === null ? 'Chapter' : hit.chapterTitle}
                      </span>
                    </SelectableRow>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            GUIDE_GROUP_ORDER.map((group) => (
              <div key={group} className="flex flex-col gap-0.5">
                <Eyebrow label={GUIDE_GROUP_LABEL[group]} className="px-2 py-1" />
                {GUIDE_CHAPTERS.filter((chapter) => chapter.group === group).map((chapter) => {
                  const isActive = chapter.id === chapterId;
                  return (
                    <SelectableRow
                      key={chapter.id}
                      selected={isActive}
                      ariaCurrent={isActive ? 'true' : undefined}
                      onClick={() => onOpenChapter(chapter.id)}
                      className="items-center px-2 py-1 text-ui"
                    >
                      <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                    </SelectableRow>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollFade>
    </nav>
  );
};
