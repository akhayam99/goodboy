import { loadAgentHandoff } from './loadAgentHandoff';
import { recordAgentHandoff } from './recordAgentHandoff';
import { handoffsInitialState } from './state';
import type { HandoffsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createHandoffsSlice = ({ set, get }: SliceDeps): HandoffsSlice => ({
  ...handoffsInitialState,
  loadAgentHandoff: loadAgentHandoff(set, get),
  recordAgentHandoff: recordAgentHandoff(set),
});
