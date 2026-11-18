import { markLeadPermissionsChanged } from './markLeadPermissionsChanged';
import type { SliceDeps } from '../../slice-types';

export const createLeadPermissionsSlice = ({ set, get }: SliceDeps) => ({
  markLeadPermissionsChanged: markLeadPermissionsChanged({ set, get }),
});
