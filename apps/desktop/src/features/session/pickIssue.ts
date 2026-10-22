import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { IssueCandidate } from '../integrations/fetchIssueCandidates';
import { issueGoalOf } from './issueGoalOf';

type PickParams = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
};

export const pickIssue = ({ workspaceId, candidate }: PickParams): void => {
  useAppStore.getState().patchSessionDraft({
    workspaceId,
    patch: { pickedIssues: [candidate], workflowGoal: issueGoalOf({ candidate }) },
  });
};
