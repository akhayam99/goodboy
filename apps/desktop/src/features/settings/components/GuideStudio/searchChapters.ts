import type { GuideChapter } from './guideChapters';
import { queryWordsOf } from './queryWordsOf';

export type GuideHit = {
  readonly key: string;
  readonly chapterId: string;
  readonly chapterTitle: string;
  readonly term: string | null;
};

type MatchParams = {
  readonly parts: ReadonlyArray<string>;
  readonly words: ReadonlyArray<string>;
};

const matchesAll = ({ parts, words }: MatchParams): boolean => {
  const text = parts.join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
};

type ChapterParams = {
  readonly chapter: GuideChapter;
  readonly words: ReadonlyArray<string>;
};

const hitsOf = ({ chapter, words }: ChapterParams): ReadonlyArray<GuideHit> => {
  const chapterParts = [
    chapter.title,
    chapter.lead,
    chapter.note?.term ?? '',
    chapter.note?.desc ?? '',
    ...chapter.links.map((link) => link.label),
  ];
  const own: ReadonlyArray<GuideHit> = matchesAll({ parts: chapterParts, words })
    ? [{ key: chapter.id, chapterId: chapter.id, chapterTitle: chapter.title, term: null }]
    : [];
  const points = chapter.points.flatMap((point) =>
    matchesAll({ parts: [point.term, point.desc], words })
      ? [
          {
            key: `${chapter.id}:${point.term}`,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            term: point.term,
          },
        ]
      : [],
  );
  return [...own, ...points];
};

export type SearchChaptersParams = {
  readonly chapters: ReadonlyArray<GuideChapter>;
  readonly query: string;
};

export const searchChapters = ({
  chapters,
  query,
}: SearchChaptersParams): ReadonlyArray<GuideHit> => {
  const words = queryWordsOf({ query });
  if (words.length === 0) {
    return [];
  }
  return chapters.flatMap((chapter) => hitsOf({ chapter, words }));
};
