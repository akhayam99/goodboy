import { resolvePermissionRequest } from './resolvePermissionRequest';
import { retryBlockedTool } from './retryBlockedTool';
import { allowAndContinue } from './allowAndContinue';
import { denyWithReason } from './denyWithReason';
import type { SliceDeps } from '../../slice-types';

export const createPermissionsSlice = ({ set, get }: SliceDeps) => {
  return {
    resolvePermissionRequest: resolvePermissionRequest(set, get),
    retryBlockedTool: retryBlockedTool(get),
    allowAndContinue: allowAndContinue(set, get),
    denyWithReason: denyWithReason(get),
  };
};
