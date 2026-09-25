import { loadAgentHandoff } from './loadAgentHandoff';
import { recordAgentHandoff } from './recordAgentHandoff';
import { handoffsInitialState } from './state';
import type { GetFn, HandoffsSlice, SetFn } from './types';

export const createHandoffsSlice = (set: SetFn, get: GetFn): HandoffsSlice => ({
  ...handoffsInitialState,
  loadAgentHandoff: loadAgentHandoff(set, get),
  recordAgentHandoff: recordAgentHandoff(set),
});
