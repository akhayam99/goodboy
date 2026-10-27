import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { IssueCandidate } from '../../integrations/fetchIssueCandidates';
import { issueGoalOf } from '../../session/issueGoalOf';

type HandOffParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly issue: IssueCandidate;
};

export const handOffFirstSession = ({ workspaceId, projectId, issue }: HandOffParams): void => {
  const state = useAppStore.getState();
  state.patchSessionDraft({
    workspaceId,
    patch: {
      pickedIssues: [issue],
      workflowGoal: issueGoalOf({ candidate: issue }),
      projectIds: projectId === null ? [] : [projectId],
    },
  });
  state.openSessionDraft();
};
