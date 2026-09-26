import type { IsoDateTime, ProjectId, SecurityFindingId, WorkspaceId } from './ids';

export type SecurityFindingSubjectKind =
  'script' | 'workflow-step' | 'profile' | 'reply-template' | 'permission-rule';

export type SecretKind =
  | 'github-token'
  | 'github-fine-grained-token'
  | 'openai-key'
  | 'slack-bot-token'
  | 'slack-user-token'
  | 'linear-api-key'
  | 'gitlab-token'
  | 'aws-access-key'
  | 'private-key'
  | 'jwt'
  | 'generic-secret';

export type SecurityFinding = Readonly<{
  id: SecurityFindingId;
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  subjectKind: SecurityFindingSubjectKind;
  subjectId: string;
  secretKind: SecretKind;
  fingerprint: string;
  last4: string;
  firstSeenAt: IsoDateTime;
  dismissedAt?: IsoDateTime;
  resolvedAt?: IsoDateTime;
}>;
