import { Search } from 'lucide-react';
import { EmptyLine, Eyebrow, SelectableRow, cn, tintClasses } from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { GUIDE_GROUP_LABEL, type GuideChapter, type GuideGroup } from '../guideChapters';

const GROUP_ORDER: ReadonlyArray<GuideGroup> = ['start', 'task', 'reference'];

type Props = {
  readonly chapters: ReadonlyArray<GuideChapter>;
  readonly activeId: string | null;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onSelect: (id: string) => void;
};

export const GuideRail = ({ chapters, activeId, query, onQueryChange, onSelect }: Props) => (
  <nav className="flex flex-col gap-2 p-3" aria-label="Guide chapters">
    <div className="flex h-7 items-center gap-2 rounded-md border border-border-soft bg-background px-2 focus-within:border-primary">
      <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <input
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search the guide"
        aria-label="Search the guide"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-label text-foreground outline-none placeholder:text-faint-foreground"
      />
    </div>
    {chapters.length === 0 ? (
      <EmptyLine className="px-2 py-2 text-label text-faint-foreground">
        No chapter mentions "{query.trim()}".
      </EmptyLine>
    ) : null}
    {GROUP_ORDER.map((group) => {
      const inGroup = chapters.filter((chapter) => chapter.group === group);
      if (inGroup.length === 0) {
        return null;
      }
      return (
        <div key={group} className="flex flex-col gap-0.5">
          <Eyebrow label={GUIDE_GROUP_LABEL[group]} className="px-2 py-1" />
          {inGroup.map((chapter) => {
            const Icon = CONCEPT_ICONS[chapter.concept];
            const isActive = chapter.id === activeId;
            return (
              <SelectableRow
                key={chapter.id}
                selected={isActive}
                ariaCurrent={isActive ? 'true' : undefined}
                onClick={() => onSelect(chapter.id)}
                className="items-center gap-2 px-3 py-2 text-body"
              >
                <Icon
                  size={ICON_SIZE.row}
                  aria-hidden
                  className={cn('shrink-0', tintClasses(CONCEPT_TONE[chapter.concept]).text)}
                />
                <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
              </SelectableRow>
            );
          })}
        </div>
      );
    })}
  </nav>
);
