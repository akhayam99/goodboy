import { isHintId } from '../director/isHintId';
import { STEP_VISITS_KEY } from './stepVisitsKey';
import type { StepVisits } from './stepVisitsTypes';

type Params = {
  readonly fallback: StepVisits;
};

type ValueParams = {
  readonly value: unknown;
};

const indexesOf = ({ value }: ValueParams): ReadonlyArray<number> =>
  Array.isArray(value)
    ? value.filter(
        (entry) => typeof entry === 'number' && Number.isSafeInteger(entry) && entry >= 0,
      )
    : [];

export const readStepVisits = ({ fallback }: Params): StepVisits => {
  try {
    const raw = window.sessionStorage.getItem(STEP_VISITS_KEY);
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
        .map(([chapterId, value]) => [chapterId, indexesOf({ value })]),
    );
  } catch {
    return fallback;
  }
};
