import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { IssueCandidate } from '../integrations/fetchIssueCandidates';

type PickParams = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
};

export const pickIssue = ({ workspaceId, candidate }: PickParams): void => {
  const goal = candidate.goal.trim();
  useAppStore.getState().patchSessionDraft({
    workspaceId,
    patch: { pickedIssues: [candidate], workflowGoal: goal === '' ? candidate.title : goal },
  });
};
