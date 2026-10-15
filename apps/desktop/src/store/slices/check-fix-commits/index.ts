import type { SliceDeps } from '../../slice-types';
import { readCheckFixCommit } from './readCheckFixCommit';

export { checkFixCommitsInitialState } from './state';

export const createCheckFixCommitsSlice = ({ set, get }: SliceDeps) => ({
  readCheckFixCommit: readCheckFixCommit({ set, get }),
});
