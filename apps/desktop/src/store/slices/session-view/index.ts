import { getSessionViewPrefs } from './getSessionViewPrefs';
import { setSessionGroup } from './setSessionGroup';
import { setSessionSort } from './setSessionSort';
import type { GetFn, SessionViewSlice, SetFn } from './types';

export { sortAndGroupSessions } from './sortAndGroupSessions';
export type { GroupedSessions, SessionViewSlice } from './types';

export const createSessionViewSlice = (set: SetFn, get: GetFn): SessionViewSlice => {
  return {
    sessionViewPrefs: {},
    getSessionViewPrefs: getSessionViewPrefs(set, get),
    setSessionSort: setSessionSort(set, get),
    setSessionGroup: setSessionGroup(set, get),
  };
};
