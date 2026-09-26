import type { IntegrationDraftId, SessionId, WorkspaceId } from './ids';

export type IntegrationDraftStatus = 'pending' | 'sent' | 'discarded';

export type IntegrationDraftTarget = Readonly<Record<string, string>>;

export type IntegrationDraft = Readonly<{
  id: IntegrationDraftId;
  workspaceId: WorkspaceId;
  sessionId: SessionId;
  provider: 'slack';
  verb: string;
  target: IntegrationDraftTarget;
  body: string;
  status: IntegrationDraftStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
}>;
