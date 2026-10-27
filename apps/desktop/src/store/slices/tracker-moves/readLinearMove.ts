import type { ProjectId, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import {
  linearFetchIssue,
  linearFetchTeamStates,
} from '../../../features/integrations/linear/client';
import { doneLinearStateOf } from './doneLinearStateOf';
import type { TrackerRead } from './types';

type Params = {
  readonly task: SessionExternalTask;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
};

const ENDED_TYPES: ReadonlySet<string> = new Set(['completed', 'canceled']);

export const readLinearMove = async ({
  task,
  workspaceId,
  projectId,
}: Params): Promise<TrackerRead> => {
  const scope = {
    workspaceId,
    issueId: task.externalId,
    ...(projectId === null ? {} : { projectId }),
  };
  const issue = await linearFetchIssue(scope);
  if (ENDED_TYPES.has(issue.state.type)) {
    return { kind: 'done' };
  }
  const states = await linearFetchTeamStates(scope);
  const target = doneLinearStateOf({ states });
  const from = states.find((state) => state.name === issue.state.name);
  if (target === null || from === undefined) {
    return { kind: 'unknown' };
  }
  return {
    kind: 'open',
    move: {
      key: `${task.provider}:${task.externalId}`,
      provider: 'linear',
      workspaceId,
      projectId,
      externalId: task.externalId,
      identifier: task.identifier,
      title: task.title,
      fromName: issue.state.name,
      toName: target.name,
      target: { kind: 'linear', stateId: target.id, fromStateId: from.id },
    },
  };
};
