import { dismissSecurityFinding } from './dismissSecurityFinding';
import { flagSecurityFindingAgain } from './flagSecurityFindingAgain';
import { loadSecurityFindings } from './loadSecurityFindings';
import { recordScanFindings } from './recordScanFindings';
import { securityFindingsInitialState } from './state';
import type { GetFn, SecurityFindingsSlice, SetFn } from './types';

export const createSecurityFindingsSlice = (set: SetFn, get: GetFn): SecurityFindingsSlice => ({
  ...securityFindingsInitialState,
  loadSecurityFindings: loadSecurityFindings(set),
  dismissSecurityFinding: dismissSecurityFinding(get),
  flagSecurityFindingAgain: flagSecurityFindingAgain(get),
  recordScanFindings: recordScanFindings(get),
});
