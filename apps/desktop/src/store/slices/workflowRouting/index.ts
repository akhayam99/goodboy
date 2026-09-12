import { resetWorkflowNodeRoutingLock } from './resetWorkflowNodeRoutingLock';
import { setWorkflowNodeRoutingLock } from './setWorkflowNodeRoutingLock';
import type { GetFn, SetFn } from './types';

export const createWorkflowRoutingSlice = (set: SetFn, get: GetFn) => ({
  setWorkflowNodeRoutingLock: setWorkflowNodeRoutingLock(set, get),
  resetWorkflowNodeRoutingLock: resetWorkflowNodeRoutingLock(set, get),
});
