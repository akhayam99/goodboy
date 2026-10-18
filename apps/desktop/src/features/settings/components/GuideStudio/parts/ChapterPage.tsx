import { Notice, PANE_RHYTHM, PaneShell, cn } from '@goodboy/ui';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { chapterStatsOf } from '../chapterStatsOf';
import { GUIDE_GROUP_LABEL, type GuideChapter } from '../guideChapters';
import type { GuideTarget } from '../guideTarget';
import { ChapterExtra } from './ChapterExtra';
import { ChapterLinks } from './ChapterLinks';
import { ChapterPager } from './ChapterPager';
import { GuidePoint } from './GuidePoint';

export type GuideFlash = {
  readonly term: string;
  readonly nonce: number;
};

type Props = {
  readonly chapter: GuideChapter;
  readonly previous: GuideChapter | null;
  readonly next: GuideChapter | null;
  readonly flash: GuideFlash | null;
  readonly onOpen: (target: GuideTarget) => void;
  readonly onGo: (id: string) => void;
};

type MetaParams = {
  readonly chapter: GuideChapter;
};

const metaOf = ({ chapter }: MetaParams): string => {
  const stats = chapterStatsOf({ chapter });
  const parts = [
    GUIDE_GROUP_LABEL[chapter.group],
    ...(stats.points > 0 ? [pluralize(stats.points, 'point')] : []),
    pluralize(stats.words, 'word'),
  ];
  return parts.join(' · ');
};

export const ChapterPage = ({ chapter, previous, next, flash, onOpen, onGo }: Props) => (
  <PaneShell page="guideChapter" title={chapter.title} meta={metaOf({ chapter })}>
    <section aria-label={chapter.title} className={PANE_RHYTHM.stack}>
      <p className={cn('text-read text-foreground', PANE_RHYTHM.prose)}>{chapter.lead}</p>
      {chapter.note === undefined ? null : (
        <Notice tone="info" placement="inline" title={chapter.note.term} body={chapter.note.desc} />
      )}
      {chapter.points.length > 0 ? (
        <div data-guide-points="" className="flex flex-col gap-5">
          {chapter.points.map((point) => (
            <GuidePoint
              key={point.term}
              term={point.term}
              desc={point.desc}
              flashNonce={flash !== null && flash.term === point.term ? flash.nonce : null}
            />
          ))}
        </div>
      ) : null}
      <ChapterExtra extra={chapter.extra} />
      <ChapterLinks links={chapter.links} onOpen={onOpen} />
      <ChapterPager previous={previous} next={next} onGo={onGo} />
    </section>
  </PaneShell>
);
