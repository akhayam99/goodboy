import type { WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';

export type { SetFn } from '../../slice-types';

export type NewSessionDraft = {
  readonly goal: string;
  readonly branchSlug: string;
  readonly slugTouched: boolean;
  readonly branchMode: 'new' | 'existing';
  readonly existingBranch: string;
  readonly issue: IssueCandidate | null;
};

export type SetNewSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
  readonly draft: Partial<NewSessionDraft>;
};

export type ClearNewSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
};
