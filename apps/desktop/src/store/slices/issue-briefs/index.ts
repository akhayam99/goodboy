import { requestIssueBrief } from './requestIssueBrief';
import { issueBriefsInitialState } from './state';
import type { GetFn, IssueBriefsSlice, SetFn } from './types';

export const createIssueBriefsSlice = (set: SetFn, get: GetFn): IssueBriefsSlice => ({
  ...issueBriefsInitialState,
  requestIssueBrief: requestIssueBrief(set, get),
});
