import type { GuideChapter } from './guideChapters';

const chapterText = ({ chapter }: { readonly chapter: GuideChapter }): string =>
  [
    chapter.title,
    chapter.lead,
    chapter.note?.term ?? '',
    chapter.note?.desc ?? '',
    ...chapter.points.flatMap((point) => [point.term, point.desc]),
    ...chapter.links.map((link) => link.label),
  ]
    .join(' ')
    .toLowerCase();

export type SearchChaptersParams = {
  readonly chapters: ReadonlyArray<GuideChapter>;
  readonly query: string;
};

export const searchChapters = ({
  chapters,
  query,
}: SearchChaptersParams): ReadonlyArray<GuideChapter> => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return chapters;
  }
  return chapters.filter((chapter) => {
    const text = chapterText({ chapter });
    return words.every((word) => text.includes(word));
  });
};
