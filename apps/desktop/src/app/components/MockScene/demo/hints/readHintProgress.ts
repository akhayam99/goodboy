import { isHintId } from '../director/isHintId';
import { HINT_PROGRESS_KEY } from './hintProgressKey';
import type { ChapterHintProgress, HintProgress } from './hintProgressTypes';

const idsOf = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((entry) => isHintId(entry)) : [];

const chapterOf = (value: unknown): ChapterHintProgress => {
  if (typeof value !== 'object' || value === null) {
    return { tried: [], skipped: [] };
  }
  return {
    tried: idsOf(Reflect.get(value, 'tried')),
    skipped: idsOf(Reflect.get(value, 'skipped')),
  };
};

export const readHintProgress = (): HintProgress => {
  try {
    const raw = window.localStorage.getItem(HINT_PROGRESS_KEY);
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([chapterId]) => isHintId(chapterId))
        .map(([chapterId, value]) => [chapterId, chapterOf(value)]),
    );
  } catch {
    return {};
  }
};
