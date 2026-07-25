import { resolvePermissionRequest } from './resolvePermissionRequest';
import { retryBlockedTool } from './retryBlockedTool';
import type { GetFn, SetFn } from './types';

export const createPermissionsSlice = (set: SetFn, get: GetFn) => {
  return {
    resolvePermissionRequest: resolvePermissionRequest(set, get),
    retryBlockedTool: retryBlockedTool(get),
  };
};
