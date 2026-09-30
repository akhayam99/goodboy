import { resetWorkflowNodeRoutingLock } from './resetWorkflowNodeRoutingLock';
import { setWorkflowNodeRoutingLock } from './setWorkflowNodeRoutingLock';
import type { SliceDeps } from '../../slice-types';

export const createWorkflowRoutingSlice = ({ set, get }: SliceDeps) => ({
  setWorkflowNodeRoutingLock: setWorkflowNodeRoutingLock(set, get),
  resetWorkflowNodeRoutingLock: resetWorkflowNodeRoutingLock(set, get),
});
