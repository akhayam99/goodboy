import { openScribePullRequest } from './openScribePullRequest';
import { refreshPrDescription } from './refreshPrDescription';
import { requestScribe } from './requestScribe';
import { resumeScribePullRequest } from './resumeScribePullRequest';
import { settleScribe } from './settleScribe';
import { stopScribe } from './stopScribe';
import type { SliceDeps } from '../../slice-types';

export { scribeInitialState } from './state';

export const createScribeSlice = ({ set, get }: SliceDeps) => {
  return {
    requestScribe: requestScribe(set, get),
    settleScribe: settleScribe(set, get),
    stopScribe: stopScribe(set, get),
    openScribePullRequest: openScribePullRequest(set, get),
    resumeScribePullRequest: resumeScribePullRequest(set, get),
    refreshPrDescription: refreshPrDescription(get),
  };
};
