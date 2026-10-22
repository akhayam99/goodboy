import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { IssueCandidate } from '../../integrations/fetchIssueCandidates';
import { issueGoalOf } from '../../session/issueGoalOf';
import { scoutKickoffPrompt } from './scoutKickoffPrompt';

type ScoutParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly prompt: string;
};

export const startFirstScout = async ({ workspaceId, projectId, prompt }: ScoutParams) => {
  const state = useAppStore.getState();
  state.patchSessionDraft({
    workspaceId,
    patch: { projectIds: projectId === null ? [] : [projectId] },
  });
  await state.startSessionFromDraft({
    workspaceId,
    start: {
      kind: 'scout',
      agentKind: 'scout',
      focus: prompt,
      prompt: scoutKickoffPrompt({ focus: prompt }),
      routing: null,
    },
  });
};

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
