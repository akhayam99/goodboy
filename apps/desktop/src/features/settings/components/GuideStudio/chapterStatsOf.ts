import type { GuideChapter } from './guideChapters';

type WordsParams = {
  readonly text: string;
};

const wordsOf = ({ text }: WordsParams): number =>
  text.split(/\s+/).filter((word) => word !== '').length;

export type ChapterStats = {
  readonly points: number;
  readonly words: number;
};

type Params = {
  readonly chapter: GuideChapter;
};

export const chapterStatsOf = ({ chapter }: Params): ChapterStats => ({
  points: chapter.points.length,
  words: [
    chapter.lead,
    chapter.note?.desc ?? '',
    ...chapter.points.map((point) => point.desc),
  ].reduce((sum, text) => sum + wordsOf({ text }), 0),
});
