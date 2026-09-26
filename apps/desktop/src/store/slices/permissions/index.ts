import { resolvePermissionRequest } from './resolvePermissionRequest';
import { retryBlockedTool } from './retryBlockedTool';
import { allowAndContinue } from './allowAndContinue';
import { denyWithReason } from './denyWithReason';
import type { GetFn, SetFn } from './types';

export const createPermissionsSlice = (set: SetFn, get: GetFn) => {
  return {
    resolvePermissionRequest: resolvePermissionRequest(set, get),
    retryBlockedTool: retryBlockedTool(get),
    allowAndContinue: allowAndContinue(set, get),
    denyWithReason: denyWithReason(get),
  };
};
