import { readHintId } from '../director/readHintId';
import { GROUP_VISITS_KEY } from './groupVisitsKey';

type Params = {
  readonly fallback: ReadonlyArray<string>;
};

export const readGroupVisits = ({ fallback }: Params): ReadonlyArray<string> => {
  try {
    const raw = window.localStorage.getItem(GROUP_VISITS_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.flatMap((entry) => {
          const id = readHintId({ value: entry });
          return id === null ? [] : [id];
        })
      : [];
  } catch {
    return fallback;
  }
};
