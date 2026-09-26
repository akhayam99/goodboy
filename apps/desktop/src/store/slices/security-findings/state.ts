import type { SecurityFinding, WorkspaceId } from '@goodboy/types';

export type SecurityFindingsState = {
  readonly openSecurityFindings: Readonly<Record<WorkspaceId, ReadonlyArray<SecurityFinding>>>;
  readonly dismissedSecurityFindings: Readonly<Record<WorkspaceId, ReadonlyArray<SecurityFinding>>>;
};

export const securityFindingsInitialState: SecurityFindingsState = {
  openSecurityFindings: {},
  dismissedSecurityFindings: {},
};
