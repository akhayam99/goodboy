import { refreshPrDescription } from './refreshPrDescription';
import { requestScribe } from './requestScribe';
import { settleScribe } from './settleScribe';
import type { SliceDeps } from '../../slice-types';

export { scribeInitialState } from './state';

export const createScribeSlice = ({ set, get }: SliceDeps) => {
  return {
    requestScribe: requestScribe(set, get),
    settleScribe: settleScribe(set, get),
    refreshPrDescription: refreshPrDescription(get),
  };
};
