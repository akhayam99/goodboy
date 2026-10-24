import { GROUP_VISITS_KEY } from './groupVisitsKey';

type Params = {
  readonly visitedIds: ReadonlyArray<string>;
};

export const writeGroupVisits = ({ visitedIds }: Params): void => {
  try {
    window.localStorage.setItem(GROUP_VISITS_KEY, JSON.stringify(visitedIds));
  } catch {
    return;
  }
};
