import type { AppState } from '../../types';
import type { IssueBriefEntry } from './types';

type Params = {
  readonly state: Pick<AppState, 'issueBriefs'>;
  readonly key: string | null;
};

export const selectIssueBrief = ({ state, key }: Params): IssueBriefEntry | null => {
  if (key === null) {
    return null;
  }
  return state.issueBriefs[key] ?? null;
};
