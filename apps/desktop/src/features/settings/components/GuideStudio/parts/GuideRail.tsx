import type { ReactNode } from 'react';
import { Eyebrow, ScrollFade, SelectableRow } from '@goodboy/ui';
import { GUIDE_CHAPTERS, GUIDE_GROUP_LABEL, GUIDE_GROUP_ORDER } from '../guideChapters';

type Props = {
  readonly chapterId: string;
  readonly header: ReactNode;
  readonly results: ReactNode | null;
  readonly onOpenChapter: (id: string) => void;
};

export const GuideRail = ({ chapterId, header, results, onOpenChapter }: Props) => (
  <nav aria-label="Guide chapters" className="flex min-h-0 flex-1 flex-col gap-2">
    {header}
    <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {results ??
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
          ))}
      </div>
    </ScrollFade>
  </nav>
);
