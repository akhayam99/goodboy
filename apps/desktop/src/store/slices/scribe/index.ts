import { requestScribe } from './requestScribe';
import { settleScribe } from './settleScribe';
import type { GetFn, SetFn } from './types';

export { scribeInitialState } from './state';

export const createScribeSlice = (set: SetFn, get: GetFn) => {
  return {
    requestScribe: requestScribe(set, get),
    settleScribe: settleScribe(set, get),
  };
};
