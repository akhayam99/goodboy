import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { IssueCandidate } from '../integrations/fetchIssueCandidates';
import { issueBriefSource } from './components/SessionKickoff/issueBriefSource';

type PickParams = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
};

export const candidateKey = ({ candidate }: Pick<PickParams, 'candidate'>): string =>
  `${candidate.provider}:${candidate.externalId}`;

export const pickIssue = ({ workspaceId, candidate }: PickParams): void => {
  const { patchSessionDraft, requestIssueBrief } = useAppStore.getState();
  patchSessionDraft({
    workspaceId,
    patch: { choice: 'task', issueKey: candidateKey({ candidate }), pickedIssue: candidate },
  });
  void requestIssueBrief({
    source: issueBriefSource({ candidate }),
    workspaceId,
    sessionId: null,
  });
};
