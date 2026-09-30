import { dismissSecurityFinding } from './dismissSecurityFinding';
import { flagSecurityFindingAgain } from './flagSecurityFindingAgain';
import { loadSecurityFindings } from './loadSecurityFindings';
import { recordScanFindings } from './recordScanFindings';
import { securityFindingsInitialState } from './state';
import type { SecurityFindingsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createSecurityFindingsSlice = ({ set, get }: SliceDeps): SecurityFindingsSlice => ({
  ...securityFindingsInitialState,
  loadSecurityFindings: loadSecurityFindings(set),
  dismissSecurityFinding: dismissSecurityFinding(get),
  flagSecurityFindingAgain: flagSecurityFindingAgain(get),
  recordScanFindings: recordScanFindings(get),
});
