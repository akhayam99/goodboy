import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { rerunFailedJobs } from '../../integrations/github/rerunFailedJobs';
import type { SessionSuggestion } from '../types';
import type { SuggestionActions } from '.';

type Payload = Extract<SessionSuggestion, { readonly kind: 'rerun-check' }>['payload'];

type Params = {
  readonly payload: Payload;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
};

export const rerunCheckAction = ({
  payload,
  workspaceId,
  projectId,
}: Params): SuggestionActions['primary'] => ({
  label: NAMES.rerunCheck,
  isDisabled: projectId === null,
  failureTitle: `Couldn't rerun ${payload.checkName}`,
  run: async () => {
    if (projectId === null) {
      return;
    }
    await rerunFailedJobs({ runId: payload.runId, cwd: payload.cwd, workspaceId, projectId });
  },
});
