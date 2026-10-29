import { readHintId } from '../director/readHintId';
import { HINT_PROGRESS_KEY } from './hintProgressKey';
import type { ChapterHintProgress, HintProgress } from './hintProgressTypes';

type ValueParams = {
  readonly value: unknown;
};

type Params = {
  readonly fallback: HintProgress;
};

const idsOf = ({ value }: ValueParams): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const id = readHintId({ value: entry });
        return id === null ? [] : [id];
      })
    : [];

const epochOf = ({ value }: ValueParams): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

const chapterOf = ({ value }: ValueParams): ChapterHintProgress => {
  if (typeof value !== 'object' || value === null) {
    return { tried: [], epoch: 0 };
  }
  return {
    tried: idsOf({ value: Reflect.get(value, 'tried') }),
    epoch: epochOf({ value: Reflect.get(value, 'epoch') }),
  };
};

export const readHintProgress = ({ fallback }: Params): HintProgress => {
  try {
    const raw = window.sessionStorage.getItem(HINT_PROGRESS_KEY);
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([chapterId]) => readHintId({ value: chapterId }) !== null)
        .map(([chapterId, value]) => [chapterId, chapterOf({ value })]),
    );
  } catch {
    return fallback;
  }
};
