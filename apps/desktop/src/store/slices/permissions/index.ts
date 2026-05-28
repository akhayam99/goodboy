import { resolvePermissionRequest } from './resolvePermissionRequest';
import type { GetFn, SetFn } from './types';

export function createPermissionsSlice(set: SetFn, get: GetFn) {
  return {
    resolvePermissionRequest: resolvePermissionRequest(set, get),
  };
}
