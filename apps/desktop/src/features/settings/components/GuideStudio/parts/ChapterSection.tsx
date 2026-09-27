import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Notice, SectionHeader, cn, tintClasses } from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import type { GuideChapter } from '../guideChapters';
import type { GuideTarget } from '../guideTarget';

type Props = {
  readonly chapter: GuideChapter;
  readonly onOpen: (target: GuideTarget) => void;
  readonly children?: ReactNode;
};

export const ChapterSection = ({ chapter, onOpen, children }: Props) => {
  const Icon = CONCEPT_ICONS[chapter.concept];
  return (
    <section aria-label={chapter.title} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeader
          size="page"
          icon={
            <Icon
              size={ICON_SIZE.control}
              aria-hidden
              className={tintClasses(CONCEPT_TONE[chapter.concept]).text}
            />
          }
          label={chapter.title}
          hint={chapter.lead}
        />
        {chapter.links.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {chapter.links.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => onOpen(link.target)}
                className="flex items-center gap-0.5 text-label text-primary hover:underline"
              >
                {link.label}
                <ChevronRight size={ICON_SIZE.row} aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {chapter.note === undefined ? null : (
        <Notice tone="info" placement="inline" title={chapter.note.term} body={chapter.note.desc} />
      )}
      {chapter.points.length > 0 ? (
        <dl className={cn('grid gap-x-8 gap-y-5', chapter.points.length > 1 && 'grid-cols-2')}>
          {chapter.points.map((point) => (
            <div key={point.term} className="flex flex-col gap-1">
              <dt className="text-heading text-foreground">{point.term}</dt>
              <dd className="text-prose text-muted-foreground">{point.desc}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
};
