import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { IssueCandidate } from '../integrations/fetchIssueCandidates';
import { issueBriefSource } from './components/SessionKickoff/issueBriefSource';

type PickParams = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
};

export const pickIssue = ({ workspaceId, candidate }: PickParams): void => {
  const { patchSessionDraft, requestIssueBrief } = useAppStore.getState();
  patchSessionDraft({
    workspaceId,
    patch: { choice: 'task', pickedIssues: [candidate], hasPickedStep: true },
  });
  void requestIssueBrief({
    sources: [issueBriefSource({ candidate })],
    workspaceId,
    sessionId: null,
  });
};
