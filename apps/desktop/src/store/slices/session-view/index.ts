import { getSessionViewPrefs } from './getSessionViewPrefs';
import { setSessionGroup } from './setSessionGroup';
import { setSessionSort } from './setSessionSort';
import type { GetFn, SessionViewSlice, SetFn } from './types';

export { sortAndGroupSessions } from './sortAndGroupSessions';
export type {
  GroupedSessions,
  SessionViewSlice,
  SessionViewSliceActions,
  SessionViewSliceState,
} from './types';

export function createSessionViewSlice(set: SetFn, get: GetFn): SessionViewSlice {
  return {
    sessionViewPrefs: {},
    getSessionViewPrefs: getSessionViewPrefs(set, get),
    setSessionSort: setSessionSort(set, get),
    setSessionGroup: setSessionGroup(set, get),
  };
}
