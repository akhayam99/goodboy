import { GUIDE_CHAPTERS, type GuideChapter } from './guideChapters';

const FORMER_CHAPTER_IDS: Readonly<Record<string, string>> = {
  workspace: 'folders',
  history: 'commits',
  tools: 'tasks',
};

type Params = {
  readonly id: string | null;
};

type ChapterByIdParams = {
  readonly id: string;
};

const chapterById = ({ id }: ChapterByIdParams): GuideChapter | undefined =>
  GUIDE_CHAPTERS.find((chapter) => chapter.id === id);

export const resolveGuideChapter = ({ id }: Params): GuideChapter => {
  const first = GUIDE_CHAPTERS[0];
  if (first === undefined) {
    throw new Error('the Guide has no chapter');
  }
  if (id === null) {
    return first;
  }
  const direct = chapterById({ id });
  if (direct !== undefined) {
    return direct;
  }
  const current = Object.hasOwn(FORMER_CHAPTER_IDS, id) ? FORMER_CHAPTER_IDS[id] : undefined;
  return (current === undefined ? undefined : chapterById({ id: current })) ?? first;
};
