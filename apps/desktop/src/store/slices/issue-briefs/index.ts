import { requestIssueBrief } from './requestIssueBrief';
import { issueBriefsInitialState } from './state';
import type { IssueBriefsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createIssueBriefsSlice = ({ set, get }: SliceDeps): IssueBriefsSlice => ({
  ...issueBriefsInitialState,
  requestIssueBrief: requestIssueBrief({ set, get }),
});
